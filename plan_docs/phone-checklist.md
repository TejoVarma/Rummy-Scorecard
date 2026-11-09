# Real-phone checklist

Automated tests cover the game logic (202 unit tests) and the main flows in a phone-sized Chrome (15 browser tests). These checks need a **real Android phone**, because they depend on Android itself: the share sheet, the voice engine, the back button, system bars and installing the APK.

Install the latest `RummyScoreboard.apk` (from GitHub Actions → Artifacts, or a local build), then tick each line.

## Install and update
- [ ] Installs over the previous version as an **update**, with no uninstall needed, and saved games are still there.
- [ ] App icon and name ("Rummy Scoreboard Pro") look right on the home screen.

## Screen layout (Android 15/16 edge-to-edge)
- [ ] Scoreboard header sits **below** the clock and battery.
- [ ] ENTER SCORE / EDIT SCORE sit **above** the navigation bar or gesture line.
- [ ] Status bar and navigation bar icons are readable on the dark green.
- [ ] With a **light** theme saved: no dark flash when the app opens.
- [ ] Pinch-zoom works on the scoreboard.
- [ ] A long game name still fits beside the top-bar icons.

## Back button and gestures
- [ ] Back closes an open popup (Settings, Deal, Share) instead of leaving the screen.
- [ ] Back from the scoreboard goes to Home.
- [ ] Back on Home shows "Press back again to exit", and a second back exits.

## A full game
- [ ] New Game: today's date in the title, the pool box can be cleared and retyped, an empty Open drop gets a message.
- [ ] Enter 3 rounds with Show / Drop / M Drop / Full / typed scores. Totals are right.
- [ ] Typing 95 in an 80 full-count game becomes 80. **Out** knocks a player out.
- [ ] 👑 crown is on the dealer, and moves each round.
- [ ] Green rows appear for all-drop rounds, even after someone is out.
- [ ] Knock a player out → **Re-Enter** → score is highest + 1. Typing 250 in a 201 game shows a message.
- [ ] Edit the last round after a re-entry: a warning, then a confirm.
- [ ] The "Congrats" banner names the real winner, even with an out player in seat 1.

## Deal
- [ ] Deal → Points / Equal / **By Drops** / Custom all show amounts that add up to the pool.
- [ ] By Drops shows each player's drops and matches the table's rule.
- [ ] Accepting settles the match, and Edit Score is no longer offered.

## Sharing (Android share sheet)
- [ ] Share → **Image** → WhatsApp: the full scoreboard arrives as a picture, including rounds below the fold and the legend.
- [ ] Share → **Text** → WhatsApp: the totals arrive, with a bold title.
- [ ] Open the share sheet and back out: no error, and it doesn't reopen.
- [ ] Deal → Share / Copy Deal Breakdown works.

## Voice
- [ ] 🔊 reads the totals aloud.
- [ ] Settings → **Announce scores after each round** on → submitting a round speaks once. Editing it speaks the corrected totals.
- [ ] Reopening a saved game stays quiet.
- [ ] With no voice installed (if you can test it), a message says to check text-to-speech.

## Data safety
- [ ] Settings → **Export Backup** gives a `.json` file you can save to Drive or WhatsApp.
- [ ] **Restore Data** with that file asks with the counts, keeps current games, and reports what was added.
- [ ] Force-stop the app mid-game and reopen: the match is still there.
- [ ] Delete a game from Continue Game: it's gone after a restart too.

## Match hand-over and names (v1.10)
- [ ] Players → Add Player: the keyboard starts with a capital letter.
- [ ] Share → **Match file** → WhatsApp to a second phone.
- [ ] On the second phone, save the file, then Continue Game → **Import match from another phone**. The file can be picked (not greyed out), and the scoreboard opens on the right round with the same totals and dealer.
- [ ] Play a round there, then import the same old file again: the new round is still there, and a message says the phone already has it further along.

## Updating the app keeps data
- [ ] Before updating, note a saved match. Install the new APK **over** the old one (don't uninstall). The match is still in Continue Game.

## Screen reader (optional, TalkBack on)
- [ ] Top-bar icons are read as "Back to Home", "Announce scores", "Share Scorecard", "Settings", "Delete Game".
- [ ] Score cells read as "Drop", "Middle drop", "Show (won the round)".
- [ ] Opening Settings announces "Settings, dialog".
