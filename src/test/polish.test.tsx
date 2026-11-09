// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ThemeProvider } from '../themes/ThemeContext';
import { THEMES } from '../themes/themeConfig';
import { Modal } from '../components/common/Modal';
import { ScoreboardScreen } from '../components/scoreboard/ScoreboardScreen';
import { gameReducer, INITIAL_STATE } from '../state/gameReducer';
import { DEFAULT_RULES } from '../domain/scoring';
import { GameState } from '../domain/types';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('style');
  document.body.removeAttribute('style');
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('theme at launch', () => {
  it('the saved theme is already applied when the first screen draws (no wrong-colour flash)', () => {
    localStorage.setItem('rummy_color_mode', 'light');
    const seenDuringFirstRender: string[] = [];
    function FirstScreen() {
      seenDuringFirstRender.push(document.documentElement.style.getPropertyValue('--color-bg'));
      return null;
    }
    render(
      <ThemeProvider>
        <FirstScreen />
      </ThemeProvider>
    );
    expect(seenDuringFirstRender[0]).toBe(THEMES.slate_dark.lightStyles.bg);
  });
});

describe('stacked dialogs', () => {
  it('the page stays locked until the last open dialog closes', () => {
    const { rerender } = render(
      <>
        <Modal isOpen onClose={() => {}} title="Outer">outer</Modal>
        <Modal isOpen onClose={() => {}} title="Inner">inner</Modal>
      </>
    );
    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <>
        <Modal isOpen onClose={() => {}} title="Outer">outer</Modal>
        <Modal isOpen={false} onClose={() => {}} title="Inner">inner</Modal>
      </>
    );
    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <>
        <Modal isOpen={false} onClose={() => {}} title="Outer">outer</Modal>
        <Modal isOpen={false} onClose={() => {}} title="Inner">inner</Modal>
      </>
    );
    expect(document.body.style.overflow).toBe('');
  });
});

describe('confetti', () => {
  function game(finished: boolean): GameState {
    let state = gameReducer(INITIAL_STATE, {
      type: 'START_GAME',
      payload: {
        title: 'Party',
        rules: DEFAULT_RULES,
        players: [
          { id: 'p1', name: 'Ravi', avatarColor: '#000', reEntryCount: 0 },
          { id: 'p2', name: 'Amit', avatarColor: '#000', reEntryCount: 0 },
        ],
        initialSeats: ['p1', 'p2'],
        initialDealerIndex: 0,
      },
    });
    state = gameReducer(state, {
      type: 'SUBMIT_ROUND',
      payload: { roundScores: { p1: { type: 'show', points: 0 }, p2: { type: finished ? 'out' : 'open_drop', points: finished ? 201 : 24 } } },
    });
    return state;
  }

  const board = (state: GameState) => (
    <ScoreboardScreen
      state={state}
      onBack={() => {}}
      onOpenScoreInput={() => {}}
      onOpenEditScore={() => {}}
      onOpenSettings={() => {}}
      onAnnounceScores={() => {}}
      onPromptReEntry={() => {}}
      onDeleteGame={() => {}}
      onAcceptDeal={() => {}}
    />
  );

  it('does not replay when you open a game that finished earlier', () => {
    render(board(game(true)));
    expect(document.querySelector('canvas')).toBeNull();
  });

  it('plays when the game finishes while you are watching', () => {
    const { rerender } = render(board(game(false)));
    expect(document.querySelector('canvas')).toBeNull();
    rerender(board(game(true)));
    expect(document.querySelector('canvas')).not.toBeNull();
  });
});
