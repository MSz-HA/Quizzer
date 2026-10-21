// @ts-check
// Phone controller: join, suggest a category, answer, see the result
import { $, esc, t, num, loadInfo, shape, startTimer, stopTimer, paintTimer, send, connect, fsSupported, isFullscreen, goFullscreen } from './common.js';

/** @typedef {import('./types').ServerMsg} ServerMsg */
/** @typedef {import('./types').QuestionMsg} QuestionMsg */
/** @typedef {import('./types').RevealMsg} RevealMsg */

const app = /** @type {HTMLElement} */ ($('app'));
const fs = /** @type {HTMLElement} */ ($('fs'));
/** @param {string} id */
const input = id => /** @type {HTMLInputElement | null} */ ($(id));
const pid = localStorage.pid || (localStorage.pid = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now()));
let name = localStorage.name || '';
/** @type {QuestionMsg | null} */
let cur = null;

/**
 * Render a screen. mood colours the whole background (result screens), plain drops the stage gradient.
 * @param {string} html
 * @param {{ mood?: string, plain?: boolean }} [opts]
 */
function show(html, { mood = '', plain = false } = {}) {
  document.body.dataset.mood = mood;
  document.body.classList.toggle('plain', plain);
  app.innerHTML = html;
  paintTimer();
}
/** @param {string} left @param {string} [mid] */
const hdr = (left, mid = '') => `<div class="hdr"><span>${left}</span><span class="muted">${mid}</span><span data-t="mmss"></span></div>
  <div class="bar thin"><i data-bar></i></div>`;
/** @param {string} title @param {string} [text] */
const msg = (title, text = '') => show(`<div class="center mid"><h1 class="title">${title}</h1><p class="muted" style="font-size:19px">${text}</p></div>`);

// ---- Fullscreen prompt: Fullscreen API where available, "Add to Home Screen" hint on iPhone ----
const isIOS = /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = /** @type {any} */ (navigator).standalone || matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
let fsDismissed = false;
try { fsDismissed = sessionStorage.fsNo === '1'; } catch (e) {}
function updateFs() {
  const ios = isIOS && !fsSupported();
  fs.hidden = standalone || fsDismissed || isFullscreen() || !(fsSupported() || ios);
  if (fs.hidden) return;
  const icon = ios
    ? '<path d="M8 8H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-2"/><polyline points="8,6 12,2 16,6"/><line x1="12" y1="2" x2="12" y2="14"/>'
    : '<polyline points="4,9 4,4 9,4"/><polyline points="15,4 20,4 20,9"/><polyline points="20,15 20,20 15,20"/><polyline points="9,20 4,20 4,15"/>';
  fs.innerHTML = `<button class="go" id="fsgo"><svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>
    <span class="txt"><b>${t(ios ? 'ios_fs' : 'tap_fs')}</b><span>${t(ios ? 'ios_fs_sub' : 'tap_fs_sub')}</span></span></button>
    <button class="x" aria-label="${t('dismiss')}" id="fsx"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button>`;
}
fs.addEventListener('click', e => {
  const target = /** @type {Element} */ (e.target);
  if (!target.closest('button')) return;
  if (target.closest('#fsx') || !fsSupported()) {
    fsDismissed = true;
    try { sessionStorage.fsNo = '1'; } catch (err) {}
  } else goFullscreen();
  updateFs();
});
document.addEventListener('fullscreenchange', updateFs);
document.addEventListener('webkitfullscreenchange', updateFs);

// Keep the screen on during the game (only available over HTTPS; silently skipped otherwise)
/** @type {WakeLockSentinel | null} */
let wakeLock = null;
async function keepAwake() {
  try {
    if ('wakeLock' in navigator && !wakeLock && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch (e) {}
}
document.addEventListener('visibilitychange', () => { if (name) keepAwake(); });

// ---- Screens ----
function joinForm() {
  show(`<div class="center">
      <div style="display:flex;flex-direction:column;align-items:center;gap:14px"><div class="logo">Q</div><h1 class="title" style="font-size:40px">Quizzer</h1></div>
      <label for="n">${t('your_name')}</label>
      <input id="n" maxlength="16" value="${esc(name)}" autocomplete="off" enterkeyhint="go">
      <button class="btn" data-action="join">${t('join')}</button>
      <p class="hint">${t('controller')}</p></div>`);
}
function join() {
  const field = input('n');
  const v = field ? field.value.trim() : '';
  if (!v) return field?.focus();
  name = v;
  localStorage.name = name;
  goFullscreen();
  keepAwake();
  msg(t('connecting'));
  connect('player', on, () => send({ type: 'join', pid, name }));
}

/** @param {string} status */
function catForm(status) {
  const prevText = input('c')?.value ?? '';
  show(`${hdr(esc(name))}
    <div class="center">
      <div style="display:flex;flex-direction:column;gap:8px"><h1 class="title">${t('suggest')}</h1>
        <p class="muted" style="font-size:18px;line-height:1.35">${t('suggest_hint')}</p></div>
      <label for="c">${t('category')}</label>
      <input id="c" maxlength="40" autocomplete="off" enterkeyhint="send" value="${esc(prevText)}">
      <button class="btn" data-action="category">${t('send')}</button>
      <button class="btn alt" data-action="surprise"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16,3 21,3 21,8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21,16 21,21 16,21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>${t('surprise')}</button>
      ${status ? `<div class="note">${status}</div>` : ''}
    </div>`);
}
/** @param {boolean} surprise */
function sendCat(surprise) {
  const text = (input('c')?.value || '').trim();
  if (surprise || text) send({ type: 'category', text, surprise });
}

/** @param {QuestionMsg} m */
function questionScreen(m) {
  show(`${hdr(`${m.n} / ${m.total}`, t('look_tv'))}
    <div class="opts">${m.options.map((o, i) => `<button class="ans a${i}" data-action="answer" data-i="${i}">${shape(i, 34)}<span>${esc(o)}</span></button>`).join('')}</div>`, { plain: true });
}
/** @param {QuestionMsg} q @param {number} i */
function choose(q, i) {
  send({ type: 'answer', i });
  show(`${hdr(`${q.n} / ${q.total}`)}
    <div class="center mid">
      <div class="tile a${i} pop">${shape(i, 110)}</div>
      <h1 class="title">${t('locked')}</h1>
      <p style="font-size:24px;color:var(--mint)">${esc(q.options[i])}</p>
      <p class="muted" style="font-size:18px">${t('wait_others')}</p></div>`, { plain: true });
}

/** @param {RevealMsg} m */
function result(m) {
  const y = m.you;
  if (!y) return msg(t('round_over'), t('look_big'));
  const kind = y.correct ? 'correct' : y.answered ? 'wrong' : 'slow';
  const icon = {
    correct: '<polyline points="4,12.5 9.5,18 20,6.5"/>',
    wrong: '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>',
    slow: '<circle cx="12" cy="12" r="9"/><polyline points="12,7 12,12 15.5,14"/>',
  }[kind];
  const sub = y.correct ? t('points_delta', { n: num(y.delta) }) : cur ? t('answer_was', { a: esc(cur.options[m.correct]) }) : '';
  show(`<div class="hdr"><span>${cur ? `${cur.n} / ${cur.total}` : ''}</span></div>
    <div class="center mid">
      <div class="badge pop"><svg width="50%" height="50%" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${icon}</svg></div>
      <h1 class="title" style="font-size:44px">${t(kind)}</h1>
      ${sub ? `<div class="delta">${sub}</div>` : ''}</div>
    <div class="stats"><div><small>${t('score')}</small><b>${num(y.score)}</b></div>
      <div><small>${t('rank')}</small><b>#${y.rank} / ${m.scores.length}</b></div></div>`, { mood: kind });
}

/** @param {ServerMsg} m */
function on(m) {
  switch (m.type) {
    case 'joined': name = m.name; break;
    case 'lobby':
      stopTimer();
      msg(t('youre_in', { name: esc(name) }), `${t('wait_host')}<br>${t('n_players', { n: m.players.length })}`);
      break;
    case 'categories': startTimer(m.seconds); catForm(''); break;
    case 'category_ok': catForm(`${t('cat_sent', { text: `<b>${esc(m.text)}</b>` })}<br>${t('cat_change')}`); break;
    case 'generating':
      stopTimer();
      show(`<div class="center mid"><h1 class="title">${t('writing_q')}</h1>
        <div class="chips">${m.categories.map(c => `<span>${esc(c)}</span>`).join('')}</div></div>`);
      break;
    case 'question': cur = m; startTimer(m.seconds); questionScreen(m); break;
    case 'reveal': stopTimer(); result(m); break;
    case 'scores': {
      stopTimer();
      const i = m.scores.findIndex(s => s.name === name);
      msg(t(m.final ? 'game_over' : 'round_over'), i < 0 ? '' : t('you_are', { rank: i + 1, score: num(m.scores[i].score) }));
      break;
    }
    case 'error': stopTimer(); msg(t('hold_on'), esc(m.message)); break;
  }
}

app.addEventListener('click', e => {
  const b = /** @type {HTMLElement | null} */ (/** @type {Element} */ (e.target).closest('[data-action]'));
  if (!b) return;
  switch (b.dataset.action) {
    case 'join': join(); break;
    case 'category': sendCat(false); break;
    case 'surprise': sendCat(true); break;
    case 'answer': if (cur) choose(cur, Number(b.dataset.i)); break;
  }
});
app.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const id = /** @type {Element} */ (e.target).id;
  if (id === 'n') join();
  if (id === 'c') sendCat(false);
});

loadInfo().then(() => {
  updateFs();
  if (name) { msg(t('connecting')); keepAwake(); connect('player', on, () => send({ type: 'join', pid, name })); }
  else joinForm();
});
