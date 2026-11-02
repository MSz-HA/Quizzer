// @ts-check
// Phone remote (/remote): the TV's setup screen sized for a phone, plus opening the lobby and starting the game.
// Connects as a host like the TV, so both stay in sync and either can change things.
import { $, esc, t, loadInfo, connect, send } from './common.js';
import { settingsRows, wireSettings, estimate } from './setup.js';

/** @typedef {import('./types').ServerMsg} ServerMsg */

const app = /** @type {HTMLElement} */ ($('app'));
wireSettings(app);

/** @param {string} title @param {string} text @param {string} [buttons] */
const card = (title, text, buttons = '') => `<div class="center"><h1>${title}</h1><p class="muted">${text}</p>${buttons}</div>`;

/** @param {ServerMsg} m */
function on(m) {
  switch (m.type) {
    case 'setup': {
      const { total, minutes } = estimate(m.settings);
      app.innerHTML = `<h1>${t('new_game')}</h1>
        <p class="muted">${m.settings.rounds} × ${m.settings.per_round} · ${t('total_q', { n: total })} · ${t('duration', { n: minutes })}</p>
        <section class="settings">${settingsRows(m)}</section>
        <div class="dock"><button class="btn" data-action="open">${t('open_lobby')}</button></div>`;
      break;
    }
    case 'lobby':
      app.innerHTML = card(t('open_lobby'), esc(t('n_players', { n: m.players.length })),
        `<button class="btn" data-action="start"${m.players.length ? '' : ' disabled'}>${t('start')}</button>
         <button class="btn alt" data-action="setup">${t('settings')}</button>`);
      break;
    case 'scores':
      if (m.final) app.innerHTML = card(t('game_over'), '', `<button class="btn" data-action="setup">${t('play_again')}</button>`);
      break;
    case 'error':
      app.innerHTML = card(esc(m.message), '', `<button class="btn" data-action="setup">${t('back_setup')}</button>`);
      break;
    default:
      if (!app.querySelector('.playing')) app.innerHTML = card(t('remote_playing'), t('remote_playing_sub')).replace('class="center"', 'class="center playing"');
  }
}

app.addEventListener('click', e => {
  const b = /** @type {HTMLElement | null} */ (/** @type {Element} */ (e.target).closest('[data-action]'));
  const action = b?.dataset.action;
  if (action === 'open' || action === 'start' || action === 'setup') send({ type: action });
});

loadInfo().then(() => connect('host', on));
