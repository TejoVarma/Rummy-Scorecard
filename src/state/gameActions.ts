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
      type: 'UNDO_ROUND';
    }
  | {
      type: 'EDIT_LAST_ROUND';
      payload: {
        roundScores: Record<PlayerId, { type: ScoreInputType; points: number }>;
      };
    }
  | {
      type: 'REORDER_SEATS';
      payload: {
        fromIndex: number;
        toIndex: number;
      };
    }
  | {
      type: 'ACCEPT_DEAL';
      payload: {
        dealSplit: import('../domain/types').DealSplit;
      };
    }
  | {
      type: 'CANCEL_DEAL';
    }
  | {
      type: 'RESET_GAME';
    }
  | {
      type: 'LOAD_GAME';
      payload: GameState;
    };
