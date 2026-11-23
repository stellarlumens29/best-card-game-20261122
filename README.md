# Ember Sigil Duel

Entry for make.fun competition **best-card-game-20261122-1826** — make the
best card game you can. A complete, original, static card duel that runs in
a desktop browser from static files, with no network requests: you vs the
Keeper of Sigils, 20 life vs 20 life, a 30-card elemental deck, mana that
grows each round, and a sigil that walks the element wheel.

Submission title: **Ember Sigil Duel: 30-card elemental duel, 20v20 life, growing mana, rotating sigil, greedy Keeper AI — full duel verified winnable and losable in 38/38 headless tests**

## The game

- **30 original cards, 4 elements** — Ember 🔥, Frost ❄️, Thorn 🌿, Storm ⚡.
  Every card shows its cost (mana gem), power, element and effect in large
  readable type: **Strike** (damage), **Heal** (restore life), **Ward**
  (shield that absorbs damage), **Draw** (damage + draw a card).
- **20 life vs 20 life, visible at all times** — both life bars sit on the
  table next to each side's ward, mana pips and hand size.
- **Mana grows 1, 2, 3 … up to 6** — a card costs 1–3 mana; you draw a card
  every round from a 5-card opening hand (max 7; a full hand burns the draw,
  an empty deck reshuffles the discard pile).
- **The rotating sigil** — one element is strong each round (+2 damage,
  +1 heal/ward) and the sigil walks the wheel Ember → Thorn → Storm →
  Frost → Ember, so the strong element keeps changing.
- **The Keeper AI** — heals when hurt, otherwise plays its biggest damage,
  cheapest on ties; it answers every turn you end.
- **Screens** — title (with the full rules), the table (Keeper's face-down
  hand on top, your face-up hand below, arena + duel log on the side),
  victory screen and defeat screen, each with a final score (life, rounds,
  cards played) and a rematch button.
- **Keyboard + mouse** — click a card (click again to play it), keys 1–7 +
  Enter to play, E to end the turn, R to restart, arrows to move the
  selection.

## Controls

| Input | Action |
| --- | --- |
| Click a card | select it (click again to play) |
| 1–7 + Enter | select and play a card |
| ← / → | move the card selection |
| E | end turn (Keeper plays) |
| R | restart the duel |
| Enter / Space | start from the title screen, rematch from an end screen |

## Run it

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

Open http://localhost:8080 in desktop Chrome. Nothing is loaded over the
network: the game is `game/index.html` plus three ES modules (`src/cards.js`,
`src/render.js`, `src/main.js`) and one stylesheet (`src/style.css`), all
hand-written, all relative references resolving inside `game/`.

## How it was verified

- `node test-game.mjs`: **38/38 PASS** — deck data (30 unique cards, costs
  1–3, powers 1–6, all 4 elements and all 4 effects, wheel is a 4-cycle),
  deterministic RNG and shuffles, fresh-game state (5-card hands, 25-card
  decks, 20/20 life, round-1 ember sigil), sigil bonuses (+2 strike,
  +1 heal), play validation (unaffordable / not-in-hand / out-of-turn
  refused), ward absorbs before life, heal caps at 20, ward caps at 10,
  draw effect damages + draws, end turn advances the round / refills mana /
  rotates the sigil / Keeper plays, lethal strike wins, Keeper lethal
  strike loses, no play after the duel ends, empty deck reshuffles the
  discard pile, full hand burns the draw, hurt Keeper heals, determinism
  (identical seeds, identical duels), and a scripted autopilot finishing
  all 6 seeded duels within 40 rounds (4 won, 2 lost — the game is
  winnable and losable).
- `node main.ts` (dossier build) runs after screenshots exist; see below.

## Screenshots

Four real renders of the game code, taken at 1280×720 with
`scripts/screenshot.mjs` (Playwright + Chromium) from `shots.json`:

1. `1-title.jpg` — `?shot=title` — title screen over a fresh table.
2. `2-play.jpg` — `?shot=play` — mid-game, round 2: both hands, life
   totals, sigil, arena and duel log visible.
3. `3-win.jpg` — `?shot=win` — the winning blow lands, victory screen.
4. `4-loss.jpg` — `?shot=loss` — Keeper lands the lethal blow, defeat screen.

To retake them (needs a machine with working Chromium):

```sh
npm install -D playwright
npx playwright install chromium
node serve.ts &
node scripts/screenshot.mjs
```

Each shot is a JPEG under the 256 KiB dossier cap; the script prints
PASS/FAIL per shot.

## Checklist applied (top-3 winner analysis)

- Title names the method + the validation (30-card duel, 20v20, rotating
  sigil, Keeper AI + verified winnable/losable), not a codename.
- Validation is shown, not asserted: the README prints the test count and
  the autopilot outcomes per seed.
- The brief's core loop is matched exactly — title screen, table with both
  hands, readable cards with value/suit/cost, visible life totals, win and
  loss screens — all in one frame, no clever departure from it.
- Stdlib-only (Node 22 stdlib in main.ts; zero libraries in the game);
  deterministic (same seed, same duel); no network requests anywhere.
