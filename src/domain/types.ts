export type PlayerId = string;

export interface GameRules {
  poolLimit: number;          // 200, 201, 100, 101, or custom
  openDrop: number;           // default: 24 (or 20)
  middleDrop: number;         // default: 48 (or 40)
  fullCount: number;          // default: 80
  allowReEntry: boolean;      // default: true
  reEntryScoreMode: 'highest_plus_one' | 'custom_fixed';
  entryAmount?: number;       // Pool stake / entry amount per player (e.g. 100)
}

export type PlayerStatus = 'active' | 'eliminated' | 're_entered';

export interface Player {
  id: PlayerId;
  name: string;
  avatarColor: string;
  reEntryCount: number;
  reEntryScore?: number;
}

export type ScoreInputType =
  | 'show'           // 0 points (Winner)
  | 'open_drop'      // 24 points
  | 'middle_drop'    // 48 points
  | 'full_count'     // 80 points
  | 'custom'         // numeric hand points (e.g. 7, 22, 53)
  | 'out';           // Eliminated / Out

export interface PlayerRoundScore {
  playerId?: PlayerId;
  type: ScoreInputType;
  points: number;
}

export interface RoundRecord {
  roundNumber: number;
  dealerPlayerId: PlayerId;
  scores: Record<PlayerId, PlayerRoundScore>;
  cumulativeScores: Record<PlayerId, number>;
  seatsSnapshot: PlayerId[];
  playersSnapshot: Record<PlayerId, Player>;
  eliminatedInRound: PlayerId[];
  reEnteredInRound: PlayerId[];
  timestamp: number;
  isEdited?: boolean;
}

export type DealMode = 'proportional' | 'equal' | 'custom';

export interface DealSplit {
  mode: DealMode;
  payouts: Record<PlayerId, number>;       // PlayerId -> payout amount in currency (₹)
  scoresSnapshot: Record<PlayerId, number>; // Scores when deal was finalized
  totalPool: number;                       // Total pool distributed
  timestamp: number;
}

export interface GameState {
  gameId: string;
  title: string;
  createdAt: number;
  status: 'setup' | 'playing' | 'completed';
  rules: GameRules;
  players: Record<PlayerId, Player>;
  seats: PlayerId[];                 // Sequential clockwise seating order
  currentDealerIndex: number;        // Index in seats array
  rounds: RoundRecord[];
  winnerPlayerId?: PlayerId;
  dealSplit?: DealSplit;
}
