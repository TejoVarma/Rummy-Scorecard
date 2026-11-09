// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { GameSetupWizard, defaultGameTitle } from '../components/setup/GameSetupWizard';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('rummy_saved_players_v1', JSON.stringify([
    { id: 'p1', name: 'Ravi' },
    { id: 'p2', name: 'Amit' },
  ]));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function setup() {
  const onStartGame = vi.fn();
  const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
  render(<GameSetupWizard onBack={() => {}} onStartGame={onStartGame} />);
  return { onStartGame, alert };
}

function chooseBothPlayers() {
  fireEvent.click(screen.getByRole('button', { name: 'SELECT PLAYERS' }));
  fireEvent.click(screen.getByText('Ravi'));
  fireEvent.click(screen.getByText('Amit'));
  fireEvent.click(screen.getByRole('button', { name: /done \(2\)/i }));
}

function field(label: string): HTMLInputElement {
  const box = screen.getByText(label).parentElement as HTMLElement;
  return within(box).getByRole('textbox') as HTMLInputElement;
}

const start = () => fireEvent.click(screen.getByRole('button', { name: 'START GAME' }));

describe('the default game title', () => {
  it('uses the real month, whatever month it is', () => {
    expect(defaultGameTitle(new Date(2026, 11, 3, 21, 5))).toMatch(/^03 Dec 2026 - 21:05$/);
    expect(defaultGameTitle(new Date(2027, 0, 15, 8, 30))).toMatch(/^15 Jan 2027 - 08:30$/);
  });
});

describe('the score boxes', () => {
  it('can be cleared and retyped without the old number snapping back', () => {
    const { onStartGame } = setup();
    chooseBothPlayers();

    fireEvent.change(field('Game total score'), { target: { value: '' } });
    expect(field('Game total score').value).toBe('');
    fireEvent.change(field('Game total score'), { target: { value: '101' } });
    start();

    expect(onStartGame.mock.calls[0][0].rules.poolLimit).toBe(101);
  });

  it('a pool preset fills the box', () => {
    const { onStartGame } = setup();
    chooseBothPlayers();
    fireEvent.click(screen.getByRole('button', { name: '101' }));
    expect(field('Game total score').value).toBe('101');
    start();
    expect(onStartGame.mock.calls[0][0].rules.poolLimit).toBe(101);
  });

  it('an empty box is pointed out instead of silently becoming the default', () => {
    const { onStartGame, alert } = setup();
    chooseBothPlayers();
    fireEvent.change(field('Open drop'), { target: { value: '' } });
    start();
    expect(alert).toHaveBeenCalledWith('Please fill in Open drop.');
    expect(onStartGame).not.toHaveBeenCalled();
  });

  it('a 0 gets the real rule message instead of turning into 24', () => {
    const { onStartGame, alert } = setup();
    chooseBothPlayers();
    fireEvent.change(field('Open drop'), { target: { value: '0' } });
    start();
    expect(alert).toHaveBeenCalledWith('Open Drop must be greater than 0.');
    expect(onStartGame).not.toHaveBeenCalled();
  });

  it('an empty stake means no stake', () => {
    const { onStartGame } = setup();
    chooseBothPlayers();
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '' } });
    start();
    expect(onStartGame.mock.calls[0][0].rules.entryAmount).toBe(0);
  });
});

describe('players added in the picker', () => {
  it('show up in the seating list straight away', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'SELECT PLAYERS' }));
    fireEvent.click(screen.getByRole('button', { name: /add new player/i }));
    fireEvent.change(screen.getByPlaceholderText('Player name'), { target: { value: 'Kiran' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('button', { name: /done \(1\)/i }));

    expect(screen.getByText('Kiran')).toBeTruthy();
    expect(screen.queryByText('Player')).toBeNull();
  });
});
