import { GameState, PlayerId, RoundRecord } from '../domain/types';
import { GameAction } from './gameActions';
import { getNextDealerIndex, relocateReEnteredPlayer, reorderSeats } from '../domain/seating';
import { calculateReEntryScore, getActivePlayerIds, isEliminated } from '../domain/elimination';

export const INITIAL_STATE: GameState = {
  gameId: '',
  title: '',
  createdAt: 0,
  status: 'setup',
  rules: {
    poolLimit: 201,
    openDrop: 24,
    middleDrop: 48,
    fullCount: 80,
    allowReEntry: true,
    reEntryScoreMode: 'highest_plus_one',
    entryAmount: 0,
  },
  players: {},
  seats: [],
  currentDealerIndex: 0,
  rounds: [],
};

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME': {
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
      };
    }

    case 'SUBMIT_ROUND': {
      if (state.status !== 'playing') return state;
      const { roundScores } = action.payload;
      const roundNum = state.rounds.length + 1;
      const currentDealerId = state.seats[state.currentDealerIndex];

      // Calculate previous cumulative scores
      const prevCumulative: Record<PlayerId, number> =
        state.rounds.length > 0
          ? state.rounds[state.rounds.length - 1].cumulativeScores
          : Object.fromEntries(state.seats.map(id => [id, 0]));

      // Calculate new cumulative scores
      const newCumulative: Record<PlayerId, number> = {};
      const eliminatedInRound: PlayerId[] = [];

      for (const id of state.seats) {
        const prev = prevCumulative[id] ?? 0;
        const roundPts = roundScores[id]?.points ?? 0;
        const total = prev + roundPts;
        newCumulative[id] = total;

        if (isEliminated(total, state.rules.poolLimit) && !isEliminated(prev, state.rules.poolLimit)) {
          eliminatedInRound.push(id);
        }
      }

      // Check active players
      const activeIds = getActivePlayerIds(state.seats, newCumulative, state.rules.poolLimit);

      // Check winner condition
      let winnerId: PlayerId | undefined = undefined;
      let newStatus: 'playing' | 'completed' = 'playing';
      if (activeIds.size === 1) {
        winnerId = Array.from(activeIds)[0];
        newStatus = 'completed';
      } else if (activeIds.size === 0) {
        // Tie-breaker: if all players cross pool limit in the same round, lowest cumulative score wins
        winnerId = state.seats
          .slice()
          .sort((a, b) => (newCumulative[a] ?? 0) - (newCumulative[b] ?? 0))[0];
        newStatus = 'completed';
      }

      // Advance dealer to next active player (or retain current dealer if the first player after dealer was eliminated)
      const nextDealerIdx = getNextDealerIndex(
        state.seats,
        state.currentDealerIndex,
        activeIds,
        eliminatedInRound
      );

      const roundRecord: RoundRecord = {
        roundNumber: roundNum,
        dealerPlayerId: currentDealerId,
        scores: roundScores,
        cumulativeScores: newCumulative,
        seatsSnapshot: [...state.seats],
        playersSnapshot: { ...state.players },
        eliminatedInRound,
        reEnteredInRound: [],
        timestamp: Date.now(),
      };

      return {
        ...state,
        status: newStatus,
        winnerPlayerId: winnerId,
        currentDealerIndex: nextDealerIdx,
        rounds: [...state.rounds, roundRecord],
      };
    }

    case 'EDIT_LAST_ROUND': {
      if (state.rounds.length === 0) return state;
      const { roundScores } = action.payload;
      const lastRoundIndex = state.rounds.length - 1;
      const lastRound = state.rounds[lastRoundIndex];

      // Enforce: Edit once only for the last round!
      if (lastRound.isEdited) return state;

      // When editing the last round, cancel any re-entries that occurred after it!
      // Restore seating order and players to the pre-re-entry snapshot of this round.
      const restoredSeats = lastRound.seatsSnapshot || state.seats;
      const restoredPlayers = lastRound.playersSnapshot || state.players;

      // Calculate previous cumulative scores prior to the last round
      const prevCumulative: Record<PlayerId, number> =
        lastRoundIndex > 0
          ? state.rounds[lastRoundIndex - 1].cumulativeScores
          : Object.fromEntries(restoredSeats.map(id => [id, 0]));

      // Calculate new cumulative scores for the edited round
      const newCumulative: Record<PlayerId, number> = {};
      const eliminatedInRound: PlayerId[] = [];

      for (const id of restoredSeats) {
        const prev = prevCumulative[id] ?? 0;
        const roundPts = roundScores[id]?.points ?? 0;
        const total = prev + roundPts;
        newCumulative[id] = total;

        if (isEliminated(total, state.rules.poolLimit) && !isEliminated(prev, state.rules.poolLimit)) {
          eliminatedInRound.push(id);
        }
      }

      // Check active players on restored seats
      const activeIds = getActivePlayerIds(restoredSeats, newCumulative, state.rules.poolLimit);

      // Check winner condition
      let winnerId: PlayerId | undefined = undefined;
      let newStatus: 'playing' | 'completed' = 'playing';
      if (activeIds.size === 1) {
        winnerId = Array.from(activeIds)[0];
        newStatus = 'completed';
      } else if (activeIds.size === 0) {
        // Tie-breaker: if all players cross pool limit in the same round, lowest cumulative score wins
        winnerId = restoredSeats
          .slice()
          .sort((a, b) => (newCumulative[a] ?? 0) - (newCumulative[b] ?? 0))[0];
        newStatus = 'completed';
      }

      // Re-evaluate dealer index based on last round's dealer in restored seats
      const roundDealerIndex = restoredSeats.indexOf(lastRound.dealerPlayerId);
      const nextDealerIdx = getNextDealerIndex(
        restoredSeats,
        roundDealerIndex >= 0 ? roundDealerIndex : 0,
        activeIds,
        eliminatedInRound
      );

      const updatedRound: RoundRecord = {
        ...lastRound,
        scores: roundScores,
        cumulativeScores: newCumulative,
        eliminatedInRound,
        reEnteredInRound: [], // Re-entry cancelled upon score editing!
        isEdited: true,
        timestamp: Date.now(),
      };

      const newRounds = [...state.rounds];
      newRounds[lastRoundIndex] = updatedRound;

      return {
        ...state,
        status: newStatus,
        winnerPlayerId: winnerId,
        players: restoredPlayers,
        seats: restoredSeats,
        currentDealerIndex: nextDealerIdx,
        rounds: newRounds,
      };
    }

    case 'RE_ENTER_PLAYER': {
      const { playerId, customReEntryScore } = action.payload;
      const lastRound = state.rounds[state.rounds.length - 1];
      if (!lastRound) return state;

      const player = state.players[playerId];
      if (!player) return state;

      // Guard: Cannot re-enter if player has already re-entered in this round
      if (lastRound.reEnteredInRound?.includes(playerId)) return state;

      // Guard: Cannot re-enter if player is already active / not eliminated
      if (!isEliminated(lastRound.cumulativeScores[playerId] ?? 0, state.rules.poolLimit)) return state;

      const currentDealerId = state.seats[state.currentDealerIndex];

      // Calculate active player scores
      const activeScores = state.seats
        .filter(id => id !== playerId && !isEliminated(lastRound.cumulativeScores[id] ?? 0, state.rules.poolLimit))
        .map(id => lastRound.cumulativeScores[id] ?? 0);

      const newScore = customReEntryScore ?? calculateReEntryScore(activeScores, state.rules);

      // Relocate seating order immediately before dealer (to dealer's left) so they receive cards last
      const updatedSeats = relocateReEnteredPlayer(state.seats, currentDealerId, playerId);
      const newDealerIndex = updatedSeats.indexOf(currentDealerId);

      // Update cumulative scores
      const updatedCumulative = {
        ...lastRound.cumulativeScores,
        [playerId]: newScore,
      };

      // Update player object
      const updatedPlayer = {
        ...player,
        reEntryCount: player.reEntryCount + 1,
        reEntryScore: newScore,
      };

      // Update last round record
      const updatedRounds = [...state.rounds];
      updatedRounds[updatedRounds.length - 1] = {
        ...lastRound,
        cumulativeScores: updatedCumulative,
        reEnteredInRound: [...lastRound.reEnteredInRound, playerId],
      };

      // Recalculate active players to determine status and winner
      const newActiveIds = getActivePlayerIds(updatedSeats, updatedCumulative, state.rules.poolLimit);
      const isCompleted = newActiveIds.size <= 1;
      const winnerId = isCompleted && newActiveIds.size === 1 ? Array.from(newActiveIds)[0] : undefined;

      return {
        ...state,
        status: isCompleted ? 'completed' : 'playing',
        winnerPlayerId: winnerId,
        players: {
          ...state.players,
          [playerId]: updatedPlayer,
        },
        seats: updatedSeats,
        currentDealerIndex: newDealerIndex >= 0 ? newDealerIndex : 0,
        rounds: updatedRounds,
      };
    }

    case 'UNDO_ROUND': {
      if (state.rounds.length === 0) return state;
      const poppedRounds = state.rounds.slice(0, -1);
      const previousRound = poppedRounds[poppedRounds.length - 1];

      // Restore seats and dealer from previous round snapshot or initial
      const restoredSeats = previousRound ? previousRound.seatsSnapshot : state.seats;
      const lastDealerId = state.rounds[state.rounds.length - 1].dealerPlayerId;
      const restoredDealerIndex = restoredSeats.indexOf(lastDealerId);

      // Restore players snapshot so reEntryCount and reEntryScore don't leak
      const restoredPlayers = previousRound
        ? previousRound.playersSnapshot
        : Object.fromEntries(
            Object.entries(state.players).map(([id, p]) => [
              id,
              { ...p, reEntryCount: 0, reEntryScore: undefined },
            ])
          );

      return {
        ...state,
        status: 'playing',
        winnerPlayerId: undefined,
        currentDealerIndex: restoredDealerIndex >= 0 ? restoredDealerIndex : 0,
        seats: restoredSeats,
        players: restoredPlayers,
        rounds: poppedRounds,
      };
    }

    case 'REORDER_SEATS': {
      const { fromIndex, toIndex } = action.payload;
      const currentDealerId = state.seats[state.currentDealerIndex];
      const newSeats = reorderSeats(state.seats, fromIndex, toIndex);
      const newDealerIndex = newSeats.indexOf(currentDealerId);

      return {
        ...state,
        seats: newSeats,
        currentDealerIndex: newDealerIndex >= 0 ? newDealerIndex : 0,
      };
    }

    case 'RESET_GAME': {
      return INITIAL_STATE;
    }

    case 'LOAD_GAME': {
      if (action.payload && typeof action.payload === 'object' && Array.isArray(action.payload.seats)) {
        return action.payload;
      }
      return state;
    }

    default:
      return state;
  }
}
