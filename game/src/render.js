// Ember Sigil Duel — DOM rendering. Pure functions of the game state:
// renderGame(game, ui) repaints the whole table from scratch.
import {
  CARD_BY_ID, ELEMENT_MARK, ELEMENT_NAME, EFFECT_NAME, MAX_LIFE, effectivePower,
} from './cards.js';

function manaPips(mana, max) {
  let s = '';
  for (let i = 0; i < max; i++) s += i < mana ? '●' : '○';
  return s;
}

function lifeBar(life) {
  const pct = Math.max(0, (life / MAX_LIFE) * 100);
  return `<div class="lifebar"><div class="fill" style="width:${pct}%"></div><div class="num">♥ ${life} / ${MAX_LIFE}</div></div>`;
}

function cardHtml(game, id, opts = {}) {
  const card = CARD_BY_ID.get(id);
  const power = effectivePower(game, card);
  const sigilBoost = card.element === game.sigil;
  const afford = opts.affordable !== false;
  const cls = [
    'card', card.element,
    opts.selected ? 'selected' : '',
    afford ? 'affordable' : 'unaffordable',
  ].join(' ');
  const effectText = {
    strike: `Deal ${power} damage to Keeper.`,
    draw: `Deal ${power} damage, then draw 1 card.`,
    heal: `Restore ${power} of your life.`,
    ward: `Gain ${power} ward (absorbs damage).`,
  }[card.effect];
  return `<div class="${cls}" data-card="${id}" title="${card.name}">
    ${opts.key ? `<div class="key">${opts.key}</div>` : ''}
    <div class="top"><div class="cost">${card.cost}</div><div class="mark">${ELEMENT_MARK[card.element]}</div></div>
    <div class="art">${ELEMENT_MARK[card.element]}</div>
    <div class="name">${card.name}</div>
    <div class="effect">${EFFECT_NAME[card.effect]} · ${ELEMENT_NAME[card.element]}${sigilBoost ? ' · SIGIL +2' : ''}</div>
    <div class="power">${card.effect === 'heal' ? '+' : ''}${power} ${card.effect === 'ward' ? 'ward' : card.effect === 'heal' ? 'life' : 'damage'}</div>
  </div>`;
}

function backHtml() {
  return `<div class="card back"><div class="sigil">🃏</div><div class="txt">KEEPER</div></div>`;
}

/** Repaint the table, the hands, the log and the overlays from the game state. */
export function renderGame(game, ui) {
  const p = game.player;
  const r = game.rival;

  ui.roundPill.textContent = `Round ${game.round}`;
  ui.sigilPill.innerHTML = `<span class="lbl">SIGIL</span>${ELEMENT_MARK[game.sigil]} ${ELEMENT_NAME[game.sigil]} +2`;
  ui.deckPill.innerHTML = `<span class="lbl">DECK</span>You ${p.deck.length} · Keeper ${r.deck.length}`;

  // Rival row.
  ui.rivalName.innerHTML = `<div class="name">Keeper of Sigils</div><div class="role">Rival · AI opponent</div>
    ${lifeBar(r.life)}
    <div class="statline">🛡 Ward <b>${r.shield}</b> &nbsp; ◆ Mana <b>${manaPips(r.mana, r.maxMana)} ${r.mana}/${r.maxMana}</b> &nbsp; 🂠 Hand <b>${r.hand.length}</b></div>`;
  ui.rivalHand.innerHTML = r.hand.map(() => backHtml()).join('') ||
    '<div class="rowlabel">Keeper has no cards in hand</div>';

  // Arena.
  ui.arenaSigil.innerHTML = `Active sigil: <b>${ELEMENT_MARK[game.sigil]} ${ELEMENT_NAME[game.sigil]}</b> — ${ELEMENT_NAME[game.sigil]} cards gain +2 damage / +1 heal &amp; ward this round. Next round: <b>${ELEMENT_NAME[game.sigil === 'ember' ? 'thorn' : game.sigil === 'thorn' ? 'storm' : game.sigil === 'storm' ? 'frost' : 'ember']}</b>.`;
  ui.lastPlay.textContent = game.lastPlay
    ? game.lastPlay.text
    : 'No card played yet — play a card from your hand below.';
  ui.turnBanner.textContent = game.phase === 'player'
    ? `Your turn — ${p.mana} mana. Click a card (or press 1–${p.hand.length}, then Enter) to play it, then End Turn.`
    : game.phase === 'won'
      ? 'You won the duel!'
      : game.phase === 'lost'
        ? 'Keeper won the duel.'
        : 'Keeper is thinking…';

  // Player row.
  ui.playerName.innerHTML = `<div class="name">You — Sigil Duelist</div><div class="role">Player · keyboard + mouse</div>
    ${lifeBar(p.life)}
    <div class="statline">🛡 Ward <b>${p.shield}</b> &nbsp; ◆ Mana <b>${manaPips(p.mana, p.maxMana)} ${p.mana}/${p.maxMana}</b> &nbsp; 🂠 Hand <b>${p.hand.length}</b></div>`;
  ui.playerHand.innerHTML = p.hand.map((id, i) => cardHtml(game, id, {
    selected: ui.selected === i,
    affordable: game.phase === 'player' && CARD_BY_ID.get(id).cost <= p.mana,
    key: i + 1,
  })).join('') || '<div class="rowlabel">Your hand is empty</div>';

  // Log (newest last, scrolled to bottom).
  ui.log.innerHTML = game.log.map((line) => `<p>${line}</p>`).join('');
  ui.log.scrollTop = ui.log.scrollHeight;

  // Controls.
  ui.endTurn.disabled = game.phase !== 'player';
  ui.hint.innerHTML = `<b>1–${Math.max(p.hand.length, 1)}</b> select card · <b>Enter</b> play · <b>E</b> end turn · <b>R</b> restart`;

  // Overlays.
  ui.titleOverlay.classList.toggle('hidden', ui.started);
  ui.winOverlay.classList.toggle('hidden', game.phase !== 'won');
  ui.lossOverlay.classList.toggle('hidden', game.phase !== 'lost');
  if (game.phase === 'won') {
    ui.winScore.innerHTML = `Final score — <b>Life ${p.life} vs ${r.life}</b> · Rounds <b>${game.round}</b> · Cards played <b>${game.plays}</b><br>Keeper's life reached 0. The sigils are yours.`;
  }
  if (game.phase === 'lost') {
    ui.lossScore.innerHTML = `Final score — <b>Life ${p.life} vs ${r.life}</b> · Rounds <b>${game.round}</b> · Cards played <b>${game.plays}</b><br>Your life reached 0. The Keeper keeps the table — rematch?`;
  }
}
