// Ember Sigil Duel — browser wiring: input, turn flow and screenshot shots.
// The game itself lives in cards.js (pure logic) and render.js (DOM paint).
// Open game/index.html in desktop Chrome. Keyboard + mouse only, no network.
//
// Screenshot shots (deterministic, seed 1 unless ?seed=N):
//   ?shot=title  — title screen over a fresh table
//   ?shot=play   — mid-game: two rounds played, both hands + life totals visible
//   ?shot=win    — the winning blow lands, victory screen up
//   ?shot=loss   — Keeper lands the lethal blow, defeat screen up
import { createGame, playCard, endTurn, aiTurn, CARD_BY_ID, effectivePower } from './cards.js';
import { renderGame } from './render.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || '1') || 1;

const ui = {
  roundPill: $('round-pill'),
  sigilPill: $('sigil-pill'),
  deckPill: $('deck-pill'),
  rivalName: $('rival-name'),
  rivalHand: $('rival-hand'),
  arenaSigil: $('arena-sigil'),
  lastPlay: $('last-play'),
  turnBanner: $('turn-banner'),
  playerName: $('player-name'),
  playerHand: $('player-hand'),
  log: $('log'),
  endTurn: $('end-turn'),
  restart: $('restart'),
  hint: $('hint'),
  titleOverlay: $('title-overlay'),
  winOverlay: $('win-overlay'),
  lossOverlay: $('loss-overlay'),
  winScore: $('win-score'),
  lossScore: $('loss-score'),
  startBtn: $('start-btn'),
  againWin: $('again-win'),
  againLoss: $('again-loss'),
  started: false,
  selected: -1,
};

let game = createGame(seed);

function repaint() {
  renderGame(game, ui);
}

function newGame() {
  game = createGame(seed);
  ui.selected = -1;
  ui.started = true;
  repaint();
}

function playSelected() {
  if (game.phase !== 'player' || ui.selected < 0 || ui.selected >= game.player.hand.length) return;
  const id = game.player.hand[ui.selected];
  const res = playCard(game, 'player', id);
  if (!res.ok) {
    ui.turnBanner.textContent = `Cannot play ${CARD_BY_ID.get(id).name}: ${res.reason}.`;
  }
  ui.selected = -1;
  repaint();
}

ui.playerHand.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-card]');
  if (!el || game.phase !== 'player') return;
  const idx = game.player.hand.indexOf(el.dataset.card);
  if (idx < 0) return;
  if (ui.selected === idx) {
    playSelected(); // click a selected card again to play it
  } else {
    ui.selected = idx;
    repaint();
  }
});

ui.endTurn.addEventListener('click', () => {
  if (game.phase !== 'player') return;
  ui.selected = -1;
  endTurn(game);
  repaint();
});
ui.restart.addEventListener('click', newGame);
ui.startBtn.addEventListener('click', () => { ui.started = true; repaint(); });
ui.againWin.addEventListener('click', newGame);
ui.againLoss.addEventListener('click', newGame);

document.addEventListener('keydown', (ev) => {
  if (!ui.started) {
    if (ev.key === 'Enter' || ev.key === ' ') { ui.started = true; repaint(); }
    return;
  }
  if (game.phase === 'won' || game.phase === 'lost') {
    if (ev.key === 'r' || ev.key === 'R' || ev.key === 'Enter') newGame();
    return;
  }
  if (ev.key >= '1' && ev.key <= '7') {
    const idx = Number(ev.key) - 1;
    if (idx < game.player.hand.length) { ui.selected = idx; repaint(); }
  } else if (ev.key === 'Enter' || ev.key === ' ') {
    ev.preventDefault();
    playSelected();
  } else if (ev.key === 'e' || ev.key === 'E') {
    if (game.phase === 'player') { ui.selected = -1; endTurn(game); repaint(); }
  } else if (ev.key === 'r' || ev.key === 'R') {
    newGame();
  } else if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
    const n = game.player.hand.length;
    if (n > 0) {
      ui.selected = ui.selected < 0 ? 0 : (ui.selected + (ev.key === 'ArrowRight' ? 1 : -1) + n) % n;
      repaint();
    }
  }
});

// ---- screenshot shots: scripted, deterministic states for the dossier ----
function shotPlay() {
  // Round 1: play the best affordable strike, end turn (Keeper answers).
  ui.started = true;
  const playable = game.player.hand
    .map((id) => CARD_BY_ID.get(id))
    .filter((c) => c.cost <= game.player.mana)
    .sort((a, b) => effectivePower(game, b) - effectivePower(game, a));
  if (playable[0]) playCard(game, 'player', playable[0].id);
  if (game.phase === 'player') endTurn(game);
  // Round 2: play one more affordable strike, leave the turn open mid-game.
  if (game.phase === 'player') {
    const again = game.player.hand
      .map((id) => CARD_BY_ID.get(id))
      .filter((c) => c.cost <= game.player.mana)
      .sort((a, b) => effectivePower(game, b) - effectivePower(game, a));
    if (again[0]) playCard(game, 'player', again[0].id);
  }
}

function shotWin() {
  ui.started = true;
  game.rival.life = 4;
  game.player.hand.push('inferno'); // Ember strike, 6 power (+2 on round-1 ember sigil)
  game.player.mana = 6;
  playCard(game, 'player', 'inferno');
}

function shotLoss() {
  ui.started = true;
  game.player.life = 3;
  game.round = 3; // Keeper mana refills to 3, enough for Tempest (cost 3)
  game.rival.hand.push('tempest'); // Storm strike, 6 power
  aiTurn(game);
}

const shot = params.get('shot');
if (shot === 'play') shotPlay();
else if (shot === 'win') shotWin();
else if (shot === 'loss') shotLoss();
else ui.started = shot !== 'title' ? ui.started : false;

repaint();
