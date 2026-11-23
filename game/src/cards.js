// Ember Sigil Duel — pure game logic (no DOM, no browser).
// A duel of original elemental sigil cards: you vs the rival Keeper.
// Both sides start at 20 life. Each turn you gain mana (1, 2, 3 … up to 6),
// draw a card, and play cards from a 5-card hand. A card costs mana and
// has a power plus one effect: strike (damage), heal (restore life),
// ward (gain shield that absorbs damage), draw (damage + draw a card).
// The active sigil rotates each round (Ember -> Frost -> Thorn -> Storm):
// a card matching the active sigil is stronger (+2 damage, +1 heal/ward).
// The elemental wheel: Ember beats Thorn, Thorn beats Storm, Storm beats
// Frost, Frost beats Ember. The active sigil walks the wheel each round,
// so the strong element keeps changing — shown on the table.
// First side to 0 life loses. Deterministic under a seed (mulberry32).

export const MAX_LIFE = 20;
export const MAX_MANA = 6;
export const START_HAND = 5;
export const MAX_HAND = 7;
export const MAX_SHIELD = 10;

export const ELEMENTS = ['ember', 'thorn', 'storm', 'frost'];
export const ELEMENT_NAME = { ember: 'Ember', frost: 'Frost', thorn: 'Thorn', storm: 'Storm' };
export const ELEMENT_MARK = { ember: '🔥', frost: '❄️', thorn: '🌿', storm: '⚡' };
/** The wheel: BEATS[a] is the element a is strong against. */
export const BEATS = { ember: 'thorn', thorn: 'storm', storm: 'frost', frost: 'ember' };
export const EFFECT_NAME = { strike: 'Strike', heal: 'Heal', ward: 'Ward', draw: 'Draw' };

/** The 30-card deck: 4 elements, costs 1-3, powers 1-6, four effects. */
export const CARD_DEFS = [
  { id: 'ember-imp', name: 'Ember Imp', element: 'ember', cost: 1, power: 2, effect: 'strike' },
  { id: 'cinder-slash', name: 'Cinder Slash', element: 'ember', cost: 1, power: 3, effect: 'strike' },
  { id: 'flame-lash', name: 'Flame Lash', element: 'ember', cost: 2, power: 4, effect: 'strike' },
  { id: 'firebrand', name: 'Firebrand', element: 'ember', cost: 2, power: 3, effect: 'draw' },
  { id: 'phoenix-rise', name: 'Phoenix Rise', element: 'ember', cost: 2, power: 4, effect: 'heal' },
  { id: 'inferno', name: 'Inferno', element: 'ember', cost: 3, power: 6, effect: 'strike' },
  { id: 'ember-guard', name: 'Ember Guard', element: 'ember', cost: 1, power: 3, effect: 'ward' },
  { id: 'spark-fan', name: 'Spark Fan', element: 'ember', cost: 1, power: 2, effect: 'draw' },
  { id: 'frostbite', name: 'Frostbite', element: 'frost', cost: 1, power: 2, effect: 'strike' },
  { id: 'ice-shard', name: 'Ice Shard', element: 'frost', cost: 1, power: 3, effect: 'strike' },
  { id: 'glacial-wall', name: 'Glacial Wall', element: 'frost', cost: 1, power: 3, effect: 'ward' },
  { id: 'snow-owl', name: 'Snow Owl', element: 'frost', cost: 2, power: 4, effect: 'strike' },
  { id: 'winter-mend', name: 'Winter Mend', element: 'frost', cost: 2, power: 4, effect: 'heal' },
  { id: 'blizzard', name: 'Blizzard', element: 'frost', cost: 3, power: 6, effect: 'strike' },
  { id: 'frozen-insight', name: 'Frozen Insight', element: 'frost', cost: 2, power: 3, effect: 'draw' },
  { id: 'thorn-whip', name: 'Thorn Whip', element: 'thorn', cost: 1, power: 2, effect: 'strike' },
  { id: 'bramble', name: 'Bramble', element: 'thorn', cost: 1, power: 3, effect: 'ward' },
  { id: 'vine-snare', name: 'Vine Snare', element: 'thorn', cost: 1, power: 3, effect: 'strike' },
  { id: 'root-mend', name: 'Root Mend', element: 'thorn', cost: 2, power: 4, effect: 'heal' },
  { id: 'briar-wolf', name: 'Briar Wolf', element: 'thorn', cost: 2, power: 4, effect: 'strike' },
  { id: 'overgrowth', name: 'Overgrowth', element: 'thorn', cost: 3, power: 6, effect: 'strike' },
  { id: 'spore-sight', name: 'Spore Sight', element: 'thorn', cost: 2, power: 3, effect: 'draw' },
  { id: 'petal-shield', name: 'Petal Shield', element: 'thorn', cost: 1, power: 2, effect: 'ward' },
  { id: 'static-zap', name: 'Static Zap', element: 'storm', cost: 1, power: 2, effect: 'strike' },
  { id: 'gale-cut', name: 'Gale Cut', element: 'storm', cost: 1, power: 3, effect: 'strike' },
  { id: 'stormcall', name: 'Stormcall', element: 'storm', cost: 2, power: 4, effect: 'strike' },
  { id: 'lightning-rod', name: 'Lightning Rod', element: 'storm', cost: 1, power: 3, effect: 'ward' },
  { id: 'thunder-mend', name: 'Thunder Mend', element: 'storm', cost: 2, power: 4, effect: 'heal' },
  { id: 'tempest', name: 'Tempest', element: 'storm', cost: 3, power: 6, effect: 'strike' },
  { id: 'far-sight', name: 'Far Sight', element: 'storm', cost: 2, power: 3, effect: 'draw' },
];

export const CARD_BY_ID = new Map(CARD_DEFS.map((c) => [c.id, c]));

/** Deterministic PRNG (mulberry32). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A shuffled copy of the 30-card deck under the given rng. */
export function buildDeck(rng) {
  const deck = CARD_DEFS.map((c) => c.id);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function newSide(deck) {
  return {
    life: MAX_LIFE,
    shield: 0,
    mana: 1,
    maxMana: 1,
    deck,
    hand: [],
    discard: [],
  };
}

/** A fresh duel. `seed` drives both shuffles; the same seed replays the same duel. */
export function createGame(seed = 1) {
  const rngP = mulberry32(seed);
  const rngR = mulberry32(seed + 7919);
  const game = {
    seed,
    round: 1,
    phase: 'player', // 'player' | 'ai' | 'won' | 'lost'
    sigil: ELEMENTS[0],
    player: newSide(buildDeck(rngP)),
    rival: newSide(buildDeck(rngR)),
    log: [],
    lastPlay: null, // { by: 'player'|'rival', card, text } — shown in the arena
    winner: null,
    plays: 0,
  };
  drawCards(game, 'player', START_HAND);
  drawCards(game, 'rival', START_HAND);
  log(game, 'The duel begins. Both sides hold 5 sigil cards. Life 20 vs 20.');
  log(game, `Round 1 sigil: ${ELEMENT_NAME[game.sigil]} — ${ELEMENT_NAME[game.sigil]} cards are stronger this round.`);
  return game;
}

export function log(game, text) {
  game.log.push(text);
  if (game.log.length > 40) game.log.shift();
}

/** The sigil of a round: it rotates one step per round, along the wheel. */
export function sigilOf(round) {
  return ELEMENTS[(round - 1) % ELEMENTS.length];
}
/** Effective power of a card this round: +2 damage / +1 heal-ward on a sigil match. */
export function effectivePower(game, card) {
  const match = card.element === game.sigil;
  if (card.effect === 'strike' || card.effect === 'draw') return card.power + (match ? 2 : 0);
  return card.power + (match ? 1 : 0);
}

/** +1 damage when the attacker's element beats the defender's ward sigil. */
export function wheelBonus(attackerElement, defenderElement) {
  return BEATS[attackerElement] === defenderElement ? 1 : 0;
}

function drawCards(game, who, n) {
  const side = game[who];
  for (let i = 0; i < n; i++) {
    if (side.deck.length === 0) {
      if (side.discard.length === 0) return;
      // Reshuffle the discard pile back into the deck.
      const rng = mulberry32(game.seed + game.plays * 131 + side.discard.length);
      side.deck = buildDeckFromIds(side.discard, rng);
      side.discard = [];
      log(game, `${who === 'player' ? 'You' : 'Keeper'} reshuffle the discard pile into a new deck.`);
    }
    const id = side.deck.pop();
    if (side.hand.length >= MAX_HAND) {
      side.discard.push(id);
      log(game, `${who === 'player' ? 'Your' : "Keeper's"} hand is full — ${CARD_BY_ID.get(id).name} is burned.`);
    } else {
      side.hand.push(id);
    }
  }
}

function buildDeckFromIds(ids, rng) {
  const deck = [...ids];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** Deal damage to a side, shield absorbing first. Returns the life damage dealt. */
export function dealDamage(game, who, amount) {
  const side = game[who];
  const absorbed = Math.min(side.shield, amount);
  side.shield -= absorbed;
  const lifeDamage = amount - absorbed;
  side.life = Math.max(0, side.life - lifeDamage);
  return { absorbed, lifeDamage };
}

function checkEnd(game) {
  if (game.rival.life <= 0) {
    game.phase = 'won';
    game.winner = 'player';
    log(game, 'Keeper falls. You win the duel!');
  } else if (game.player.life <= 0) {
    game.phase = 'lost';
    game.winner = 'rival';
    log(game, 'Your life hits 0. Keeper wins the duel.');
  }
}

/**
 * Play a card from `who`'s hand. Returns { ok, reason?, text? }.
 * Only the player may be refused by phase; the AI plays through endTurn.
 */
export function playCard(game, who, cardId) {
  if (game.phase === 'won' || game.phase === 'lost') return { ok: false, reason: 'duel over' };
  if (who === 'player' && game.phase !== 'player') return { ok: false, reason: 'not your turn' };
  const side = game[who];
  const foe = who === 'player' ? 'rival' : 'player';
  const idx = side.hand.indexOf(cardId);
  if (idx < 0) return { ok: false, reason: 'card not in hand' };
  const card = CARD_BY_ID.get(cardId);
  if (side.mana < card.cost) return { ok: false, reason: 'not enough mana' };
  side.mana -= card.cost;
  side.hand.splice(idx, 1);
  side.discard.push(cardId);
  game.plays += 1;
  const power = effectivePower(game, card);
  const me = who === 'player' ? 'You' : 'Keeper';
  let text = '';
  if (card.effect === 'strike' || card.effect === 'draw') {
    const total = power;
    const { absorbed, lifeDamage } = dealDamage(game, foe, total);
    text = `${me} play ${card.name} (${ELEMENT_MARK[card.element]} ${ELEMENT_NAME[card.element]}, ${total} damage${card.element === game.sigil ? ' incl. +2 sigil' : ''}) — ${foe === 'player' ? 'you take' : 'Keeper takes'} ${lifeDamage} life${absorbed ? ` (${absorbed} absorbed by ward)` : ''}.`;
    if (card.effect === 'draw') {
      drawCards(game, who, 1);
      text += ` ${me} draw a card.`;
    }
  } else if (card.effect === 'heal') {
    const before = side.life;
    side.life = Math.min(MAX_LIFE, side.life + power);
    text = `${me} play ${card.name} — restore ${side.life - before} life (now ${side.life}).`;
  } else if (card.effect === 'ward') {
    side.shield = Math.min(MAX_SHIELD, side.shield + power);
    text = `${me} play ${card.name} — gain ${power} ward (now ${side.shield}).`;
  }
  game.lastPlay = { by: who, card: cardId, text };
  log(game, text);
  checkEnd(game);
  return { ok: true, text };
}

/** End the player's turn: the rival plays, then a new round starts. */
export function endTurn(game) {
  if (game.phase !== 'player') return { ok: false, reason: 'not your turn' };
  game.phase = 'ai';
  aiTurn(game);
  if (game.phase === 'won' || game.phase === 'lost') return { ok: true };
  game.round += 1;
  game.sigil = sigilOf(game.round);
  game.phase = 'player';
  const mana = Math.min(MAX_MANA, game.round);
  game.player.maxMana = mana;
  game.player.mana = mana;
  drawCards(game, 'player', 1);
  log(game, `Round ${game.round} — sigil: ${ELEMENT_NAME[game.sigil]}. Your mana refills to ${mana}. You draw a card.`);
  return { ok: true };
}

/**
 * The rival's turn, played greedily and deterministically:
 * heal when hurt and a heal is affordable, ward when it has no strike,
 * otherwise the biggest damage it can afford, cheapest first on ties.
 * It keeps playing while it can afford a card and has cards.
 */
export function aiTurn(game) {
  const mana = Math.min(MAX_MANA, game.round);
  game.rival.maxMana = mana;
  game.rival.mana = mana;
  drawCards(game, 'rival', 1);
  log(game, `Keeper's turn — mana ${mana}.`);
  let guard = 0;
  while (guard++ < 12) {
    const playable = game.rival.hand
      .map((id) => CARD_BY_ID.get(id))
      .filter((c) => c.cost <= game.rival.mana);
    if (playable.length === 0) break;
    let pick = null;
    const hurt = game.rival.life <= 9;
    if (hurt) pick = playable.filter((c) => c.effect === 'heal').sort((a, b) => b.power - a.power)[0] ?? null;
    if (!pick) {
      const strikes = playable.filter((c) => c.effect === 'strike' || c.effect === 'draw');
      if (strikes.length > 0) {
        pick = [...strikes].sort((a, b) => effectivePower(game, b) - effectivePower(game, a) || a.cost - b.cost)[0];
      }
    }
    if (!pick) pick = [...playable].sort((a, b) => b.power - a.power || a.cost - b.cost)[0];
    if (!pick) break;
    const res = playCard(game, 'rival', pick.id);
    if (!res.ok) break;
    if (game.phase === 'won' || game.phase === 'lost') return;
  }
  log(game, 'Keeper ends its turn.');
}

/** A small serialisable snapshot for tests and determinism checks. */
export function snapshot(game) {
  return JSON.stringify({
    round: game.round,
    phase: game.phase,
    sigil: game.sigil,
    player: { life: game.player.life, shield: game.player.shield, mana: game.player.mana, hand: game.player.hand, deck: game.player.deck.length },
    rival: { life: game.rival.life, shield: game.rival.shield, mana: game.rival.mana, hand: game.rival.hand, deck: game.rival.deck.length },
    plays: game.plays,
    log: game.log.length,
  });
}

/**
 * A scripted autopilot: play the best affordable strike each turn, then end
 * the turn, until the duel ends or `maxRounds` pass. Used by tests to prove
 * a full duel can be won and lost, and by the screenshot shots.
 */
export function autopilot(game, maxRounds = 40) {
  let rounds = 0;
  while ((game.phase === 'player' || game.phase === 'ai') && rounds < maxRounds) {
    if (game.phase === 'player') {
      let guard = 0;
      while (guard++ < 10) {
        const playable = game.player.hand
          .map((id) => CARD_BY_ID.get(id))
          .filter((c) => c.cost <= game.player.mana);
        if (playable.length === 0) break;
        const strikes = playable.filter((c) => c.effect === 'strike' || c.effect === 'draw');
        const pick = strikes.length > 0
          ? [...strikes].sort((a, b) => effectivePower(game, b) - effectivePower(game, a) || a.cost - b.cost)[0]
          : [...playable].sort((a, b) => b.power - a.power)[0];
        playCard(game, 'player', pick.id);
        if (game.phase === 'won' || game.phase === 'lost') break;
      }
      if (game.phase === 'player') endTurn(game);
    }
    rounds++;
  }
  return game;
}
