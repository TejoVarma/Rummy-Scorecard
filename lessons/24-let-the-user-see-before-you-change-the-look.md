# 24 · Let the user see it before you change the look

## The problem it solves

Phase 5 made many **visible** changes on the strength of guidelines: bigger 44 px buttons everywhere, darker colours for contrast, a legend with full sentences, taller chips and tabs. Each one was "correct" against a rule, but together they made the app **bulkier and duller**:
- "Out" wrapped onto a second line on every player card
- SUBMIT fell off-screen with 4 players
- a small yellow "Deal" pill became a large blob
- the legend was cut off

Tejo's reaction: *"Why did you change everything? We need a nice user experience with colours."* He was right. Guidelines are inputs to a product decision, not a substitute for it.

## Everyday analogy: the tailor

A tailor follows rules for good fit, but still holds up the mirror before cutting the cloth. The customer decides what looks right on *them*.

## What we did

1. **Showed instead of described.** We built v1.7 (before Phase 5) in a separate `git worktree`, served both builds locally, and took **phone-sized screenshots** of the same seeded game with Playwright (`devices['Pixel 7']`).
2. **Put them side by side on one page**, with a *Keep new / Back to old* choice per visible change and a **Copy my choices** button. Tejo picked, and pasted back one line:
   > Dealer crown = keep new; Legend always shown = keep new; Big Deal pill = back to old; Taller top bar = back to old; Bright original colours = back to old; Big score buttons = back to old; 0–80 hint and ✕ = keep new; Tall New Game chips = back to old; Tall deal tabs = back to old
3. **Changed exactly that**, plus his follow-ups: a *short* legend, and the ✕ kept while the range hint went.
4. **Re-took the screenshots** and updated the page so he could check the result **before** anything was committed.

Everything invisible stayed: screen-reader names, dialogs, labels, pinch-zoom, focus handling, tests.

## How the tooling worked

```bash
git worktree add <scratch>/v17 e7bc3bd          # a second checkout of an older commit, side by side
(cd <scratch>/v17 && npm ci && npx vite build)
(cd <scratch>/v17/dist && python3 -m http.server 4301 &)
(cd dist && python3 -m http.server 4302 &)
node shoot.mjs http://localhost:4301/ v17 …    # Playwright: seed localStorage, visit each screen, screenshot
node shoot.mjs http://localhost:4302/ v18 …
```

The seeded game was built with the app's own reducer (a real 5-round game with a re-entry and a ₹2500 pool), so every screen showed realistic content, and the same game drove both versions.

## What can go wrong (interview angle)

**"How do you balance accessibility guidelines with design?"** Separate the **invisible** wins (semantics, names, focus, zoom), which you just ship, from the **visible** ones (sizes, colours), which you show to the product owner with real screenshots and let them decide. Record the trade-off.

**"A stakeholder says 'you changed everything'. What do you do?"** Don't argue from guidelines. Make the change visible (side-by-side), offer per-item choices, apply exactly what they choose, and show the result before shipping.

**"Why a git worktree?"** It checks out another commit into a separate folder **without** disturbing your current work. It's ideal for comparing builds, or for fixing an old release while new work is in progress.

## From zero, by hand

1. `git worktree add ../v17 <old-commit>`, then `npm ci && npx vite build` inside it.
2. Serve both `dist` folders on two ports.
3. Script Playwright with a phone device profile: seed `localStorage` with the same game via `addInitScript`, open each screen, take a screenshot.
4. Put the pairs on one page with a per-change choice, and collect the choices.
5. Apply exactly those, re-screenshot, and get a yes before committing.
6. `git worktree remove ../v17` when done.
