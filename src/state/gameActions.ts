import { GameRules, GameState, Player, PlayerId, ScoreInputType } from '../domain/types';

export type GameAction =
  | {
      type: 'START_GAME';
      payload: {
        title: string;
        rules: GameRules;
        players: Player[];
        initialSeats: PlayerId[];
        initialDealerIndex: number;
      };
    }
  | {
      type: 'SUBMIT_ROUND';
      payload: {
        roundScores: Record<PlayerId, { type: ScoreInputType; points: number }>;
      };
    }
  | {
      type: 'RE_ENTER_PLAYER';
      payload: {
        playerId: PlayerId;
        customReEntryScore?: number;
      };
    }
  | {
      // In the order picked (highest card first); the last one sits beside the dealer.
      type: 'RE_ENTER_PLAYERS';
      payload: {
        playerIds: PlayerId[];
        customReEntryScore?: number;
      };
    }
  | {
      type: 'EDIT_LAST_ROUND';
      payload: {
        roundScores: Record<PlayerId, { type: ScoreInputType; points: number }>;
      };
    }
  | {
      type: 'ACCEPT_DEAL';
      payload: {
        dealSplit: import('../domain/types').DealSplit;
      };
    }
  | {
      type: 'RESET_GAME';
    }
  | {
      type: 'LOAD_GAME';
      payload: GameState;
    };
