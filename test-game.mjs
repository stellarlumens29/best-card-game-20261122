// Ember Sigil Duel — Node test suite, re-authored in-window 22 Nov 2026.
// No DOM, no browser: the same card logic the browser plays, checked
// headlessly. Run: node test-game.mjs
import {
  MAX_LIFE, MAX_HAND, ELEMENTS, BEATS, CARD_DEFS, CARD_BY_ID,
  mulberry32, buildDeck, createGame, sigilOf, effectivePower, playCard,
  endTurn, aiTurn, dealDamage, snapshot, autopilot,
} from './game/src/cards.js';

let pass = 0;
let total = 0;
function check(name, ok, extra = '') {
  total += 1;
  if (ok) pass += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`);
}

// Deck data.
check('deck has 30 unique cards', CARD_DEFS.length === 30 && new Set(CARD_DEFS.map((c) => c.id)).size === 30);
check('all costs 1-3, all powers 1-6', CARD_DEFS.every((c) => c.cost >= 1 && c.cost <= 3 && c.power >= 1 && c.power <= 6));
check('4 elements present', new Set(CARD_DEFS.map((c) => c.element)).size === 4);
check('4 effects present', new Set(CARD_DEFS.map((c) => c.effect)).size === 4);
check('every element has a strike, a heal and a ward', ELEMENTS.every((el) =>
  ['strike', 'heal', 'ward'].every((fx) => CARD_DEFS.some((c) => c.element === el && c.effect === fx))));
check('wheel is a 4-cycle', BEATS.ember === 'thorn' && BEATS.thorn === 'storm' && BEATS.storm === 'frost' && BEATS.frost === 'ember');

// RNG + shuffle.
const r1 = mulberry32(7);
const r2 = mulberry32(7);
check('mulberry32 is deterministic', r1() === r2() && r1() === r2());
check('buildDeck shuffles 30 distinct cards', (() => {
  const d = buildDeck(mulberry32(1));
  return d.length === 30 && new Set(d).size === 30;
})());
check('same seed, same shuffle', JSON.stringify(buildDeck(mulberry32(3))) === JSON.stringify(buildDeck(mulberry32(3))));
check('different seed, different shuffle', JSON.stringify(buildDeck(mulberry32(3))) !== JSON.stringify(buildDeck(mulberry32(4))));

// Fresh game.
const g0 = createGame(1);
check('fresh game: 5-card hands, 25-card decks', g0.player.hand.length === 5 && g0.rival.hand.length === 5 && g0.player.deck.length === 25 && g0.rival.deck.length === 25);
check('fresh game: life 20/20, mana 1, round 1, ember sigil', g0.player.life === 20 && g0.rival.life === 20 && g0.player.mana === 1 && g0.round === 1 && g0.sigil === 'ember' && g0.phase === 'player');
check('sigil walks the wheel ember-thorn-storm-frost', sigilOf(1) === 'ember' && sigilOf(2) === 'thorn' && sigilOf(3) === 'storm' && sigilOf(4) === 'frost' && sigilOf(5) === 'ember');

// Effective power.
const g1 = createGame(1); // round-1 sigil is ember
const emberStrike = CARD_BY_ID.get('inferno'); // ember, strike, power 6
const frostStrike = CARD_BY_ID.get('blizzard'); // frost, strike, power 6
check('sigil match adds +2 to a strike', effectivePower(g1, emberStrike) === 8 && effectivePower(g1, frostStrike) === 6);
check('sigil match adds +1 to a heal', effectivePower(g1, CARD_BY_ID.get('phoenix-rise')) === 5 && effectivePower(g1, CARD_BY_ID.get('winter-mend')) === 4);

// Playing cards.
const g2 = createGame(1);
g2.player.hand = ['inferno', 'cinder-slash', 'ember-guard'];
g2.player.mana = 3;
const before = g2.rival.life;
const res = playCard(g2, 'player', 'cinder-slash'); // ember strike, cost 1, power 3 +2 sigil = 5
check('affordable strike plays and deals sigil-boosted damage', res.ok && g2.rival.life === before - 5 && g2.player.mana === 2, `rival ${before} -> ${g2.rival.life}`);
check('played card leaves the hand for the discard pile', !g2.player.hand.includes('cinder-slash') && g2.player.discard.includes('cinder-slash'));
const g3 = createGame(1);
g3.player.hand = ['inferno'];
g3.player.mana = 1;
check('unaffordable card is refused', !playCard(g3, 'player', 'inferno').ok && g3.player.hand.includes('inferno'));
check('card not in hand is refused', !playCard(g3, 'player', 'blizzard').ok);
const g4 = createGame(1);
g4.player.hand = ['inferno'];
g4.player.mana = 3;
check('playing out of turn is refused', (() => { g4.phase = 'ai'; return !playCard(g4, 'player', 'inferno').ok; })());

// Shield absorbs before life.
const g5 = createGame(1);
g5.rival.shield = 4;
const dmg = dealDamage(g5, 'rival', 6);
check('ward absorbs first, rest hits life', dmg.absorbed === 4 && dmg.lifeDamage === 2 && g5.rival.life === 18 && g5.rival.shield === 0);

// Heal caps at max life; ward caps at 10.
const g6 = createGame(1);
g6.player.life = 19;
g6.player.hand = ['phoenix-rise'];
g6.player.mana = 2;
playCard(g6, 'player', 'phoenix-rise'); // heal 4 +1 sigil = 5, capped
check('heal caps at 20 life', g6.player.life === MAX_LIFE);
const g7 = createGame(1);
g7.player.shield = 9;
g7.player.hand = ['ember-guard'];
g7.player.mana = 1;
playCard(g7, 'player', 'ember-guard'); // ward 3 +1 sigil = 4, capped at 10
check('ward caps at 10', g7.player.shield === 10);

// Draw effect damages and draws.
const g8 = createGame(1);
g8.player.hand = ['firebrand'];
g8.player.mana = 2;
const handBefore = g8.player.hand.length;
const deckBefore = g8.player.deck.length;
playCard(g8, 'player', 'firebrand');
check('draw card deals damage and draws one', g8.rival.life < 20 && g8.player.hand.length === handBefore && g8.player.deck.length === deckBefore - 1);

// End turn: round advances, mana refills, sigil rotates, Keeper played.
const g9 = createGame(1);
const rivalHandBefore = [...g9.rival.hand];
endTurn(g9);
check('end turn advances to round 2, thorn sigil', g9.round === 2 && g9.sigil === 'thorn' && g9.phase === 'player');
check('mana refills to the round number', g9.player.mana === 2 && g9.player.maxMana === 2);
check('player draws a card on the new round', g9.player.hand.length === 6);
check('Keeper played or passed on its turn', g9.log.some((l) => l.includes("Keeper's turn")));
check('Keeper hand or mana changed during its turn', JSON.stringify(g9.rival.hand) !== JSON.stringify(rivalHandBefore) || g9.rival.mana < g9.rival.maxMana || g9.rival.discard.length > 0);

// Win and loss.
const g10 = createGame(1);
g10.rival.life = 3;
g10.player.hand = ['cinder-slash'];
g10.player.mana = 1;
playCard(g10, 'player', 'cinder-slash');
check('lethal strike wins the duel', g10.phase === 'won' && g10.winner === 'player');
const g11 = createGame(1);
g11.player.life = 3;
g11.round = 3;
g11.rival.hand = ['tempest'];
aiTurn(g11);
check('Keeper lethal strike loses the duel', g11.phase === 'lost' && g11.winner === 'rival', `phase ${g11.phase}`);
const g12 = createGame(1);
playCard(g12, 'player', g12.player.hand[0]);
check('no play after the duel ends', (() => {
  g12.rival.life = 0;
  g12.phase = 'won';
  return !playCard(g12, 'player', g12.player.hand[0]).ok;
})());

// Deck exhaustion reshuffles the discard pile.
const g13 = createGame(1);
g13.player.deck = [];
g13.player.discard = ['cinder-slash', 'inferno', 'blizzard', 'thorn-whip', 'gale-cut'];
g13.player.hand = [];
const drawn = g13.player.hand.length;
// draw via a fresh round: end turn draws 1 for the player
endTurn(g13);
check('empty deck reshuffles the discard pile', g13.player.deck.length > 0 || g13.player.hand.length > drawn, `deck ${g13.player.deck.length}, hand ${g13.player.hand.length}`);

// Hand cap burns the drawn card.
const g14 = createGame(1);
g14.player.hand = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((x, i) => CARD_DEFS[i].id);
g14.player.deck = ['inferno'];
g14.round = 1;
const discBefore = g14.player.discard.length;
endTurn(g14); // AI turn, then round 2 draw with a full hand
check('drawing with a full hand burns the card', g14.player.hand.length === MAX_HAND && g14.player.discard.length > discBefore);

// AI behaviour: hurt Keeper heals when it can.
const g15 = createGame(1);
g15.rival.life = 5;
g15.rival.hand = ['winter-mend', 'ice-shard'];
g15.round = 2;
aiTurn(g15);
check('hurt Keeper heals instead of striking', g15.rival.life > 5 && g15.rival.discard.includes('winter-mend'), `life ${g15.rival.life}`);

// Determinism + full autopilot duels.
const runOnce = (seed) => {
  const g = createGame(seed);
  autopilot(g);
  return snapshot(g);
};
check('deterministic: identical seeds, identical duels', runOnce(1) === runOnce(1) && runOnce(5) === runOnce(5));
let finished = 0;
const outcomes = [];
for (let s = 1; s <= 6; s++) {
  const g = createGame(s);
  autopilot(g);
  if (g.phase === 'won' || g.phase === 'lost') { finished++; outcomes.push(`${s}:${g.phase}@r${g.round}`); }
}
check('autopilot finishes every duel within 40 rounds', finished === 6, outcomes.join(' '));
check('at least one autopilot duel is won', outcomes.some((o) => o.includes(':won')), outcomes.join(' '));

console.log(`\n${pass}/${total} PASS`);
process.exit(pass === total ? 0 : 1);
