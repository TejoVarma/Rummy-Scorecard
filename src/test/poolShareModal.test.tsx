// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PoolShareModal } from '../components/scoreboard/PoolShareModal';
import { ScoreboardScreen } from '../components/scoreboard/ScoreboardScreen';
import { gameReducer, INITIAL_STATE } from '../state/gameReducer';
import { DEFAULT_RULES } from '../domain/scoring';
import { GameState } from '../domain/types';

function startedGame(): GameState {
  return gameReducer(INITIAL_STATE, {
    type: 'START_GAME',
    payload: {
      title: 'Friday Pool',
      rules: { ...DEFAULT_RULES, entryAmount: 500 },
      players: [
        { id: 'p1', name: 'Ravi', avatarColor: '#3b82f6', reEntryCount: 0 },
        { id: 'p2', name: 'Amit', avatarColor: '#10b981', reEntryCount: 0 },
      ],
      initialSeats: ['p1', 'p2'],
      initialDealerIndex: 0,
    },
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('pool deal before the first round', () => {
  it('opens the deal modal without an endless re-render', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <PoolShareModal isOpen onClose={() => {}} state={startedGame()} onAcceptDeal={() => {}} />
    );

    const loopWarnings = errors.mock.calls.filter(args =>
      String(args[0]).includes('Maximum update depth')
    );
    expect(loopWarnings).toHaveLength(0);
  });

  it('hides the header Deal button until a round has been played', () => {
    render(
      <ScoreboardScreen
        state={startedGame()}
        onBack={() => {}}
        onOpenScoreInput={() => {}}
        onOpenEditScore={() => {}}
        onOpenSettings={() => {}}
        onPromptReEntry={() => {}}
        onDeleteGame={() => {}}
        onAcceptDeal={() => {}}
      />
    );

    expect(screen.queryByRole('button', { name: /^deal$/i })).toBeNull();
  });
});
