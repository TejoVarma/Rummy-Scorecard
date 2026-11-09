import { GameRules, GameState, PlayerId, PlayerRoundScore, RoundRecord } from '../domain/types';
import { GameAction } from './gameActions';
import { getNextDealerIndex, relocateReEnteredPlayer } from '../domain/seating';
import {
  calculateReEntryScore,
  getActivePlayerIds,
  getEligibleForReEntryPlayers,
  isEligibleForReEntry,
  isEliminated,
} from '../domain/elimination';
import { DEFAULT_RULES, validateRoundScores } from '../domain/scoring';
import { validateDeal, validateStartGame } from '../domain/rules';
import { isValidGameState } from '../storage/localStorageAdapter';

export const INITIAL_STATE: GameState = {
  gameId: '',
  title: '',
  createdAt: 0,
  status: 'setup',
  rules: DEFAULT_RULES,
  players: {},
  seats: [],
  currentDealerIndex: 0,
  rounds: [],
};

type RoundScores = Record<PlayerId, PlayerRoundScore>;

interface ScoredRound {
  scores: RoundScores;
  cumulativeScores: Record<PlayerId, number>;
  eliminatedInRound: PlayerId[];
  activeIds: Set<PlayerId>;
  winnerPlayerId?: PlayerId;
  status: 'playing' | 'completed';
}

/**
 * Applies one round of scores on top of the previous totals, or returns null when the
 * scores break the rules. Players already out keep an { out, 0 } entry whatever was sent.
 */
function scoreRound(
  seats: PlayerId[],
  previous: Record<PlayerId, number>,
  submitted: RoundScores,
  rules: GameRules
): ScoredRound | null {
  const inBefore = seats.filter(id => !isEliminated(previous[id] ?? 0, rules.poolLimit));
  if (!validateRoundScores(submitted, inBefore, rules).valid) return null;

  const scores: RoundScores = {};
  const cumulativeScores: Record<PlayerId, number> = {};
  const eliminatedInRound: PlayerId[] = [];
  for (const id of seats) {
    const playing = inBefore.includes(id);
    scores[id] = playing ? { type: submitted[id].type, points: submitted[id].points } : { type: 'out', points: 0 };
    const before = previous[id] ?? 0;
    cumulativeScores[id] = before + scores[id].points;
    if (playing && isEliminated(cumulativeScores[id], rules.poolLimit)) eliminatedInRound.push(id);
  }

  const activeIds = getActivePlayerIds(seats, cumulativeScores, rules.poolLimit);
  if (activeIds.size > 1) {
    return { scores, cumulativeScores, eliminatedInRound, activeIds, status: 'playing' };
  }
  // One player left wins; if everyone went out together, the lowest total wins.
  const winnerPlayerId =
    activeIds.size === 1
      ? Array.from(activeIds)[0]
      : seats.slice().sort((a, b) => cumulativeScores[a] - cumulativeScores[b])[0];
  return { scores, cumulativeScores, eliminatedInRound, activeIds, winnerPlayerId, status: 'completed' };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME': {
      if (validateStartGame(action.payload)) return state;
      const { title, rules, players, initialSeats, initialDealerIndex } = action.payload;
      const playerMap = Object.fromEntries(players.map(p => [p.id, p]));

      return {
        ...state,
        gameId: 'game_' + Date.now(),
        title: title || 'Rummy Match',
        createdAt: Date.now(),
        status: 'playing',
        rules,
        players: playerMap,
        seats: initialSeats,
        currentDealerIndex: initialDealerIndex,
        rounds: [],
        winnerPlayerId: undefined,
        dealSplit: undefined,
      };
    }

    case 'SUBMIT_ROUND': {
      if (state.status !== 'playing') return state;
      const previous =
        state.rounds.length > 0 ? state.rounds[state.rounds.length - 1].cumulativeScores : {};
      const scored = scoreRound(state.seats, previous, action.payload.roundScores, state.rules);
      if (!scored) return state;

      const roundRecord: RoundRecord = {
        roundNumber: state.rounds.length + 1,
        dealerPlayerId: state.seats[state.currentDealerIndex],
        scores: scored.scores,
        cumulativeScores: scored.cumulativeScores,
        seatsSnapshot: [...state.seats],
        playersSnapshot: { ...state.players },
        eliminatedInRound: scored.eliminatedInRound,
        reEnteredInRound: [],
        timestamp: Date.now(),
      };

      return {
        ...state,
        status: scored.status,
        winnerPlayerId: scored.winnerPlayerId,
        currentDealerIndex: getNextDealerIndex(
          state.seats,
          state.currentDealerIndex,
          scored.activeIds,
          scored.eliminatedInRound
        ),
        rounds: [...state.rounds, roundRecord],
      };
    }

    case 'EDIT_LAST_ROUND': {
      // A settled deal fixed the scores it was based on.
      if (state.rounds.length === 0 || state.dealSplit) return state;
      const lastIndex = state.rounds.length - 1;
      const lastRound = state.rounds[lastIndex];
      if (lastRound.isEdited) return state;

      // Editing cancels any re-entry made after this round: go back to how the table was.
      const seats = lastRound.seatsSnapshot || state.seats;
      const players = lastRound.playersSnapshot || state.players;
      const previous = lastIndex > 0 ? state.rounds[lastIndex - 1].cumulativeScores : {};
      const scored = scoreRound(seats, previous, action.payload.roundScores, state.rules);
      if (!scored) return state;

      const dealerIndex = seats.indexOf(lastRound.dealerPlayerId);
      const rounds = [...state.rounds];
      rounds[lastIndex] = {
        ...lastRound,
        scores: scored.scores,
        cumulativeScores: scored.cumulativeScores,
        eliminatedInRound: scored.eliminatedInRound,
        reEnteredInRound: [],
        isEdited: true,
        timestamp: Date.now(),
      };

      return {
        ...state,
        status: scored.status,
        winnerPlayerId: scored.winnerPlayerId,
        players,
        seats,
        currentDealerIndex: getNextDealerIndex(
          seats,
          dealerIndex >= 0 ? dealerIndex : 0,
          scored.activeIds,
          scored.eliminatedInRound
        ),
        rounds,
      };
    }

    case 'RE_ENTER_PLAYER': {
      const { playerId, customReEntryScore } = action.payload;
      const lastRound = state.rounds[state.rounds.length - 1];
      const player = state.players[playerId];
      const eligible = getEligibleForReEntryPlayers(state.rounds, state.seats, state.rules, Boolean(state.dealSplit));
      if (!lastRound || !player || !eligible.includes(playerId)) return state;

      const activeScores = state.seats
        .filter(id => id !== playerId && !isEliminated(lastRound.cumulativeScores[id] ?? 0, state.rules.poolLimit))
        .map(id => lastRound.cumulativeScores[id] ?? 0);
      const newScore = customReEntryScore ?? calculateReEntryScore(activeScores);
      if (!Number.isInteger(newScore) || newScore < 1 || !isEligibleForReEntry(newScore, state.rules.poolLimit)) {
        return state;
      }

      // Re-entered players sit just before the dealer, so they're dealt last.
      const currentDealerId = state.seats[state.currentDealerIndex];
      const seats = relocateReEnteredPlayer(state.seats, currentDealerId, playerId);
      const cumulativeScores = { ...lastRound.cumulativeScores, [playerId]: newScore };
      const rounds = [...state.rounds];
      rounds[rounds.length - 1] = {
        ...lastRound,
        cumulativeScores,
        reEnteredInRound: [...(lastRound.reEnteredInRound || []), playerId],
      };

      const activeIds = getActivePlayerIds(seats, cumulativeScores, state.rules.poolLimit);
      const completed = activeIds.size <= 1;
      return {
        ...state,
        status: completed ? 'completed' : 'playing',
        winnerPlayerId: completed && activeIds.size === 1 ? Array.from(activeIds)[0] : undefined,
        players: {
          ...state.players,
          [playerId]: { ...player, reEntryCount: player.reEntryCount + 1, reEntryScore: newScore },
        },
        seats,
        currentDealerIndex: Math.max(0, seats.indexOf(currentDealerId)),
        rounds,
      };
    }

    case 'ACCEPT_DEAL': {
      if (validateDeal(state, action.payload.dealSplit)) return state;
      return {
        ...state,
        status: 'completed',
        dealSplit: action.payload.dealSplit,
      };
    }

    case 'RESET_GAME': {
      return INITIAL_STATE;
    }

    case 'LOAD_GAME': {
      if (isValidGameState(action.payload)) {
        return action.payload;
      }
      console.warn('LOAD_GAME ignored invalid game state payload:', action.payload);
      return state;
    }

    default:
      return state;
  }
}
