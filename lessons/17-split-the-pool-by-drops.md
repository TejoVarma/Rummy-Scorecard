# 17 · Splitting the prize pool by drops (a payout waterfall)

## The problem it solves

When a pool game ends in a deal, Tejo's table splits the prize by **how many drops each remaining player still has**. A player with more drops is safer, so they deserve more. The app had Proportional (points), Equal and Custom splits, but not this one.

The rule, agreed with Tejo step by step, for **any number of players**:

1. **Stakes back.** Every remaining player gets **one stake** back (for example ₹500). A player who re-entered still gets just one.
2. **Drops.** Each open drop a player can still take before going out is worth **one stake**, paid from what's left. If there isn't enough left to pay every drop in full, what's left is shared **in proportion to drops**.
3. **Leftover.** Anything still left is shared **equally**.
4. **Rounding.** Whole rupees, always adding up to the exact pool. An odd rupee goes to the player with the most drops.

**Counting drops** (Tejo confirmed): how many 24-point open drops fit before the pool limit. On 150 in a 201 pool: 174 (in), 198 (in), 222 (out), so **2 drops**.

## Everyday analogy: a waterfall of buckets

Pour the pool down a staircase of buckets:
- The **first** bucket (stakes) must fill completely before any water reaches the next.
- The **second** bucket (drops) takes what it needs. If the water runs out part-way, each player's cup in that bucket fills **in proportion to its size** (pro rata).
- The **last** bucket catches whatever overflows, shared equally.

The same pattern is used to pay creditors in a bankruptcy ("senior debt first, then junior, then shareholders") and to pay out investors in startup exits. Worth being able to explain.

## Worked examples (₹500 stake)

| Pool | Drops | After stakes | Drops step | Equal step | **Payouts** |
|---|---|---|---|---|---|
| ₹4500 | 3 / 1 / 0 | ₹3000 left | ₹1500 / ₹500 / 0 (₹1000 left) | ₹333.33 each | **₹2334 / ₹1333 / ₹833** |
| ₹3000 | 4 / 2 / 0 | ₹1500 left | needs ₹3000, so ₹1500 shared 4 : 2 → ₹1000 / ₹500 / 0 | nothing left | **₹1500 / ₹1000 / ₹500** |
| ₹3000 | 2 / 2 / 0 | ₹1500 left | needs ₹2000, so shared 2 : 2 → ₹750 / ₹750 / 0 | nothing left | **₹1250 / ₹1250 / ₹500** |
| ₹3000 | 0 / 0 / 0 | ₹1500 left | none | ₹500 each | **₹1000 / ₹1000 / ₹1000** |
| ₹3000 | 2 / 0 | ₹2000 left | ₹1000 / 0 (₹1000 left) | ₹500 each | **₹2000 / ₹1000** |
| ₹3000 | 5 / 0 | ₹2000 left | needs ₹2500, so all ₹2000 to P1 | nothing left | **₹2500 / ₹500** |
| ₹3500 | 6 / 0 | ₹2500 left | needs ₹3000, so all ₹2500 to P1 | nothing left | **₹3000 / ₹500** |

The last three are Tejo's original 2-player examples. The waterfall gives the same answers, so it's **one consistent rule** for any number of players.

**Where the pool comes from:** stake × (everyone who **started**, including players already out, plus re-entries). The split is only among the players **still in**. That's how 3 remaining players can share a ₹3000 pool.

## The code

`src/domain/dealSplit.ts`:

```ts
export function calculateDropDeal(
  totalPool: number,
  stake: number,
  players: DropShareInput[]
): Record<PlayerId, number> {
  const count = players.length;
  if (count === 0) return {};

  // A pool too small to return every stake can only be shared equally.
  const stakeBack = totalPool >= stake * count ? stake : 0;
  let remaining = totalPool - stakeBack * count;

  const totalDrops = players.reduce((sum, p) => sum + p.drops, 0);
  const dropValue = totalDrops * stake;
  const dropShare = (p: DropShareInput) => {
    if (totalDrops === 0 || stake === 0) return 0;
    return dropValue <= remaining ? p.drops * stake : (remaining * p.drops) / totalDrops;
  };
  const dropPaid = players.map(dropShare);
  remaining -= dropPaid.reduce((a, b) => a + b, 0);

  const exact = players.map((p, i) => ({
    player: p,
    order: i,
    amount: stakeBack + dropPaid[i] + remaining / count,
  }));
  return roundToRupees(exact, totalPool);
}
```

Read it top to bottom as the three buckets:
- `stakeBack`: one stake each. The pool can't really be smaller than that, but if it ever were, everyone simply shares equally.
- `dropShare`: the full `drops × stake` when the money covers all drops, otherwise `remaining × drops / totalDrops` (pro rata). The `totalDrops === 0` guard avoids dividing by zero.
- `remaining / count`: the equal overflow.

### Rounding to whole rupees that still add up

```ts
// Largest-remainder rounding: round everyone down, then hand the missing rupees to the
// biggest fractions, breaking ties in favour of more drops.
function roundToRupees(shares, totalPool) {
  // floor every amount; work out how many rupees are missing; give one each to the
  // largest fractions (ties: more drops first, then seat order)
}
```

Rounding each amount to the nearest rupee on its own can make the total ₹1 off: 2333.33 + 1333.33 + 833.33 rounds to 4499. The **largest remainder method** rounds everyone down, then gives the missing rupees to the biggest fractions. Here all three fractions are .33, so the tie goes to **most drops**, as Tejo asked: ₹2334 / ₹1333 / ₹833 = **₹4500**. The `1e-9` in `Math.floor(s.amount + 1e-9)` protects against floating-point values like 999.9999999.

### Wiring it in

- `DealMode` gains `'drops'` (`src/domain/types.ts`), and the shared summary text calls it *"Drop Split (stakes back, then drops)"*.
- `PoolShareModal.tsx`:
  - computes each remaining player's drops with the app's existing `analyzePlayerDrops(...).openDropsRemaining`, the same count the scoreboard shows
  - adds a **By Drops** button (the option grid is now 2×2)
  - explains the mode: *"Everyone gets their ₹500 stake back, each drop left is worth ₹500, and anything left over is shared equally."*
  - shows `24 pts · 7 drops` under each name while that mode is selected
- Accepting a drop split goes through the same `validateDeal` as every other deal (lesson 12): the players still in, whole rupees, the exact pool. Drop splits always satisfy it.

## A bug Tejo's spot-check found: "equal" fractions that weren't

Tejo asked to check 3/2/1, 3/2/0 and 3/1/0 with awkward amounts (an odd ₹350 stake, uneven pools). Running the real function over them showed two results that broke our own rule ("an odd rupee goes to the most drops"):

| Case | Exact | App gave | Correct |
|---|---|---|---|
| 3/2/1, ₹500, ₹5000 | 2166.67 / 1666.67 / 1166.67 | ₹2166 / ₹1667 / ₹1167 | **₹2167 / ₹1667 / ₹1166** |
| 3/1/0, ₹350, ₹3150 | 1633.33 / 933.33 / 583.33 | ₹1633 / ₹934 / ₹583 | **₹1634 / ₹933 / ₹583** |

**Why:** computers store decimals in binary, so 2/3 isn't exact. The three ".67" fractions came out as `0.6666666667` vs `0.6666666666`. The sort saw them as different, so it never reached the "most drops" tie-break. Totals were still exact; only *who* got the odd rupee was wrong.

**Fix:** compare fractions with a tolerance.

```ts
// Fractions like 0.67 aren't stored exactly, so two "equal" ones can differ by a hair.
// Anything closer than a millionth of a rupee counts as a tie, settled by drops.
const byClaim = [...floored].sort((a, b) => {
  const diff = b.fraction - a.fraction;
  if (Math.abs(diff) > 1e-6) return diff;
  return b.player.drops - a.player.drops || a.order - b.order;
});
```

**Lesson:** never compare floating-point numbers for exact equality. Compare within a tolerance (an "epsilon"), or work in whole units. A test with "nice" numbers (₹500 stakes, round pools) hid this. Awkward numbers found it in seconds, so test with ugly inputs.

## The tests

**Unit tests** (`src/test/dropDeal.test.ts`, 11 tests):
- Cases A–D and the three 2-player examples, each checked for the **exact** amounts **and** that they add up to the pool.
- Nobody ever gets less than a stake, across several odd distributions.
- Results are whole rupees and add up exactly, for awkward pools (₹4700, ₹5100, ₹3100).
- The odd rupee goes to the most drops (case A: P1's equal share is ₹334).
- With no stake set, everything is ₹0 (no crash).

**End-to-end** (`e2e/dropDeal.spec.ts`): 4 players at ₹500 (pool ₹2000), Dev put out in round 1. The Deal screen → **By Drops** shows `0 pts · 8 drops`, `24 pts · 7 drops`, `80 pts · 5 drops` and **₹700 / ₹675 / ₹625**. Stakes back is ₹1500, and the ₹500 left is shared 8 : 7 : 5. Accepting the deal settles the match.

Plus a test for the two tie cases above. Totals: **175/175** unit tests and **15/15** browser tests.

## What can go wrong (interview angle)

**"How do you turn a verbal business rule into code?"** Ask for concrete examples, especially edge cases (ties, not enough money, zero), write them down as a table, get sign-off, and make that table the **test suite**. Here, three rounds of questions turned "split by drops" into exact numbers.

**"How do you split money without losing a rupee?"** Never round each share on its own. Use largest-remainder (or a similar) so the parts always sum to the whole, with an explicit tie-break.

**"Why floating point is risky with money."** `0.1 + 0.2 !== 0.3`. Here the inputs are whole rupees and the only fractions come from division, which we round once at the very end with a small epsilon guard. Many systems store money as integer paise to avoid this entirely.

## From zero, by hand

1. Write `src/test/dropDeal.test.ts` as in this repo. Run `npx vitest run src/test/dropDeal.test.ts`. Expected: failures (no `calculateDropDeal`).
2. In `src/domain/dealSplit.ts`, add `DropShareInput`, `calculateDropDeal` and `roundToRupees`, and the `'drops'` label in `formatDealSummary`. In `types.ts`, add `'drops'` to `DealMode`.
3. Run it again. Expected: `Tests  11 passed (11)`.
4. In `PoolShareModal.tsx`:
   - add `drops` to each active player via `analyzePlayerDrops`
   - handle `mode === 'drops'` in the payout memo (add `entryAmount` to its dependencies)
   - make the mode grid `grid-cols-2` and add the **By Drops** button
   - add the description line and the `pts · N drops` subtitle
5. Add `e2e/dropDeal.spec.ts`. Run `npm run test:e2e`. Expected: `15 passed`.
6. Bump to `versionCode 8` / `"1.7"`, then build.
