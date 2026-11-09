// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PlayerListScreen } from '../components/players/PlayerListScreen';
import { SelectPlayersModal } from '../components/players/SelectPlayersModal';
import { GameSetupWizard } from '../components/setup/GameSetupWizard';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('rummy_saved_players_v1', JSON.stringify([{ id: 'p1', name: 'Ravi' }]));
});

afterEach(cleanup);

describe('the phone keyboard starts names with a capital letter', () => {
  it('when adding a player from the Players screen', () => {
    render(<PlayerListScreen onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Player' }));
    expect(screen.getByLabelText('New player name').getAttribute('autocapitalize')).toBe('words');
  });

  it('when renaming a player', () => {
    render(<PlayerListScreen onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Ravi' }));
    expect(screen.getByLabelText('Player name').getAttribute('autocapitalize')).toBe('words');
  });

  it('when adding a player while picking players for a game', () => {
    render(
      <SelectPlayersModal isOpen onClose={() => {}} selectedPlayerIds={[]} onConfirmSelection={() => {}} />
    );
    fireEvent.click(screen.getByRole('button', { name: /add new player/i }));
    expect(screen.getByLabelText('New player name').getAttribute('autocapitalize')).toBe('words');
  });

  it('when typing the game title', () => {
    render(<GameSetupWizard onBack={() => {}} onStartGame={() => {}} />);
    expect(document.getElementById('setup-title')?.getAttribute('autocapitalize')).toBe('sentences');
  });
});
