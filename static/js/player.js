// @ts-check
// Phone controller: join, suggest a category, vote, answer, see the result
import { $, esc, t, num, loadInfo, shape, avatar, suggestedBy, startTimer, stopTimer, paintTimer, send, connect, fsSupported, isFullscreen, goFullscreen, isSprint, roundSize, INK, paintPoints, paintStrokes } from './common.js';

/** @typedef {import('./types').ServerMsg} ServerMsg */
/** @typedef {import('./types').QuestionMsg} QuestionMsg */
/** @typedef {import('./types').RevealMsg} RevealMsg */
/** @typedef {import('./types').Player} Player */
/** @typedef {import('./types').Info} Info */
/** @typedef {import('./types').VoteMsg} VoteMsg */
/** @typedef {import('./types').RoundInfo} RoundInfo */
/** @typedef {import('./types').SortItem} SortItem */
/** @typedef {import('./types').CompareItem} CompareItem */
/** @typedef {import('./types').AboutMsg} AboutMsg */
/** @typedef {import('./types').Stroke} Stroke */

const app = /** @type {HTMLElement} */ ($('app'));
const fs = /** @type {HTMLElement} */ ($('fs'));
/** @param {string} id */
const input = id => /** @type {HTMLInputElement | null} */ ($(id));
const pid = localStorage.pid || (localStorage.pid = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now()));
/** Saved identity. Reused automatically only if the player was active recently (same game). @type {Player} */
let me = { name: localStorage.name || '', avatar: localStorage.avatar || '', color: localStorage.color || '' };
const RECENT_MS = 2 * 60 * 60 * 1000;
const recent = Date.now() - Number(localStorage.seen || 0) < RECENT_MS;
/** Join form state while picking a name and look. @type {Player} */
let draft = { ...me };
/** @type {Partial<Info>} */
let info = {};
/** @type {Player[]} */
let lobbyPlayers = [];
let editing = false, connected = false;
/** Host setting: show colour/avatar pickers (updated from every lobby message) */
let avatarsOn = true;
/** @type {QuestionMsg | null} */
let cur = null;

/**
 * Render a screen. mood colours the whole background (result screens), plain drops the stage gradient.
 * @param {string} html
 * @param {{ mood?: string, plain?: boolean }} [opts]
 */
function show(html, { mood = '', plain = false } = {}) {
  clearTimeout(holdTimer);
  clearTimeout(waitTimer);
  document.body.dataset.mood = mood;
  document.body.classList.toggle('plain', plain);
  app.innerHTML = html;
  paintTimer();
}
/** @param {string} left @param {string} [mid] */
const hdr = (left, mid = '') => `<div class="hdr"><span>${left}</span><span class="muted">${mid}</span><span data-t="mmss"></span></div>
  <div class="bar thin"><i data-bar></i></div>`;
// Round Continue button: the game moves on once anyone holds it for HOLD_MS, while a ring fills around it
const HOLD_MS = 1000;
let holdTimer = 0, waitTimer = 0;
/** @param {number} [wait] seconds the button stays disabled, see allowHold() */
const holdBtn = (wait = 0) => `<div class="cont"><button class="hold" data-hold${wait ? ' disabled' : ''}><svg viewBox="0 0 100 100" aria-hidden="true">
    <circle class="track" cx="50" cy="50" r="46"/><circle class="fill" cx="50" cy="50" r="46" pathLength="100"/></svg>${t('continue')}</button>
  <p class="hint">${t('hold_hint')}</p></div>`;
/** Enable the Continue button after `wait` seconds (the server ignores Continue until then) @param {number} wait */
const allowHold = wait => { waitTimer = window.setTimeout(() => app.querySelector('[data-hold]')?.removeAttribute('disabled'), wait * 1000); };
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
document.addEventListener('visibilitychange', () => { if (connected) keepAwake(); });

// ---- Screens ----
/** Name (and, with avatars on, colour + avatar) form. Used to join and to change identity between games. */
function joinForm() {
  editing = true;
  const colors = info.colors || [], avatars = avatarsOn ? info.avatars || [] : [];
  const others = lobbyPlayers.filter(p => p.name !== me.name), taken = new Set(others.map(p => p.color));
  if (!draft.color || !colors.includes(draft.color)) draft.color = pickFree(colors, taken);
  const pickers = avatars.length ? `
      <div class="pickrow"><span class="lbl">${t('color')}</span>
        <div class="swatches">${colors.map(c => `<button class="sw${c === draft.color ? ' on' : ''}${taken.has(c) ? ' taken' : ''}" style="background:${c}"
          data-action="color" data-v="${c}" aria-label="${t('color')} ${c}" aria-pressed="${c === draft.color}"></button>`).join('')}</div></div>
      <div class="pickrow"><span class="lbl">${t('avatar')}</span>
        <div class="faces">${['', ...avatars].map(a => `<button class="face${a === draft.avatar ? ' on' : ''}" data-action="avatar" data-v="${a}"
          aria-label="${a || t('initial')}" aria-pressed="${a === draft.avatar}">${a || esc([...(draft.name || '?')][0])}</button>`).join('')}</div></div>` : '';
  show(`<div class="center">
      <div class="who-am-i">${avatars.length ? `<div id="preview">${avatar({ ...draft, name: draft.name || '?' }, 96)}</div>` : '<div class="logo">Q</div>'}
        <h1 class="title" style="font-size:40px">Quizzer</h1></div>
      <label for="n">${t('your_name')}</label>
      <input id="n" maxlength="16" value="${esc(draft.name)}" autocomplete="off" enterkeyhint="go">
      ${pickers}
      <button class="btn" data-action="join">${t(connected ? 'save' : 'join')}</button>
      ${connected || avatars.length ? '' : `<p class="hint">${t('controller')}</p>`}</div>`);
}
function join() {
  const field = input('n');
  const v = field ? field.value.trim() : '';
  if (!v) return field?.focus();
  me = { name: v, avatar: avatarsOn ? draft.avatar : '', color: draft.color };
  Object.assign(localStorage, me);
  editing = false;
  goFullscreen();
  keepAwake();
  msg(t('connecting'));
  if (connected) send(joinMsg());
  else start();
}
/** Random item, preferring ones nobody else uses @param {string[]} list @param {Set<string>} taken */
const pickFree = (list, taken) => {
  const free = list.filter(x => !taken.has(x)), pool = free.length ? free : list;
  return pool[Math.floor(Math.random() * pool.length)] || '';
};
const joinMsg = () => /** @type {const} */ ({ type: 'join', pid, ...me });
function start() {
  connected = true;
  connect('player', on, () => send(joinMsg()));
}
const editBtn = () => `<button class="btn alt" data-action="edit">${t(avatarsOn ? 'edit_look' : 'edit_name')}</button>`;
/** Waiting in the lobby, or after a game: show who you are and let you change it */
function lobbyScreen(title = t('youre_in', { name: esc(me.name) }), text = `${t('wait_host')}<br>${t('n_players', { n: lobbyPlayers.length })}`) {
  show(`<div class="center mid">${avatar(me, 120, 'pop')}<h1 class="title">${title}</h1>
    <p class="muted" style="font-size:19px">${text}</p>${editBtn()}</div>`);
}

/** "Round 2/3" in multi-round games @param {RoundInfo | null} m */
const roundLabel = m => m && m.rounds > 1 ? t('round_short', { n: m.round, total: m.rounds }) : '';
/** The round's category vote, while it is open @type {VoteMsg | null} */
let ballot = null;

/** Category vote in the TV's colours and shapes; the picked one stays lit and can be changed. @param {VoteMsg} m @param {number} [mine] */
function voteScreen(m, mine = -1) {
  show(`${hdr(t('vote'), roundLabel(m))}
    <div class="opts">${m.options.map((o, i) => `<button class="ans a${i}${mine < 0 ? '' : i === mine ? ' on' : ' dim'}" data-action="vote" data-i="${i}"
      aria-pressed="${i === mine}">${shape(i, 34)}<span>${esc(o)}</span>${suggestedBy(m.by[i], 36)}</button>`).join('')}</div>
    ${mine < 0 ? '' : `<p class="hint">${t('vote_change')}</p>`}`, { plain: true });
}

/** @param {string} status */
function catForm(status) {
  const prevText = input('c')?.value ?? '';
  show(`${hdr(esc(me.name))}
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

/** When the answers appear (performance.now()); answer time is measured on the phone so network lag doesn't count */
let answersAt = 0;
const took = () => Math.max(0, performance.now() - answersAt) / 1000;
/** "3 / 5", or the round type in sprints (one set per round) @param {QuestionMsg} m */
const qNum = m => isSprint(m.kind) ? t('k_' + m.kind) : `${m.n} / ${m.total}`;
/** Answers stay hidden for the lock, so a tap meant for Continue can't pick one (only on the first render) @param {QuestionMsg} m */
const lock = m => performance.now() < answersAt ? ` locked" style="animation-delay:${(answersAt - performance.now()) / 1000}s` : '';
/** Order rounds: option indices tapped so far, first to last @type {number[]} */
let ordered = [];
/** Sprints: the order this phone plays the picks in, how far it got, and how many were right @type {{ seq: number[], k: number, right: number, busy: boolean }} */
let run = { seq: [], k: 0, right: 0, busy: false };

/** About rounds: the questions about you (indices in AboutMsg.asks), answered one at a time @type {{ m: AboutMsg | null, mine: number[], k: number }} */
let about = { m: null, mine: [], k: 0 };

// ---- Draw rounds: the drawer's canvas. Points go to the server in small batches, so the TV draws along ----
/** The word to draw (sent separately, to the drawer only), the drawing so far and the pen colour */
let draw = { word: '', strokes: /** @type {Stroke[]} */ ([]), ink: 0 };
/** Points of the current stroke not sent yet @type {[number, number][]} */
let pending = [];
let flushTimer = 0, drawing = false;
const pad = () => /** @type {HTMLCanvasElement | null} */ ($('pad'));
/** @param {QuestionMsg} m */
function drawScreen(m) {
  draw = { word: '', strokes: [], ink: 0 };
  show(`${hdr(qNum(m), t('you_draw'))}
    <div class="word" id="word">…</div>
    <div class="padbox"><canvas id="pad"></canvas></div>
    <div class="tools">${INK.map((c, i) => `<button class="inkbtn${i ? '' : ' on'}" style="background:${c}" data-action="ink" data-i="${i}" aria-label="${c}"></button>`).join('')}
      <button class="btn alt tool" data-action="undo" aria-label="${t('undo')}" title="${t('undo')}">↶</button>
      <button class="btn alt tool" data-action="clear" aria-label="${t('clear')}" title="${t('clear')}">✕</button></div>`, { plain: true });
  fitPad();
}
/** The biggest 4:3 canvas that fits, sharp on high-density screens */
function fitPad() {
  const cv = pad(), box = cv?.parentElement;
  if (!cv || !box) return;
  const w = Math.min(box.clientWidth, box.clientHeight * 4 / 3), dpr = devicePixelRatio || 1;
  cv.style.width = `${w}px`;
  cv.style.height = `${w * 3 / 4}px`;
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(w * 3 / 4 * dpr);
  paintStrokes(cv, draw.strokes);
}
addEventListener('resize', fitPad);
function flush() {
  if (!pending.length) return;
  send({ type: 'ink', s: draw.strokes.length - 1, c: draw.strokes[draw.strokes.length - 1].c, p: pending });
  pending = [];
}
/** @param {PointerEvent} e @returns {[number, number]} */
const at = e => {
  const r = /** @type {HTMLCanvasElement} */ (e.target).getBoundingClientRect(), k = 1000;
  return [Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * k) / k,
    Math.round(Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) * k) / k];
};
app.addEventListener('pointerdown', e => {
  const cv = pad();
  if (e.target !== cv || !cv) return;
  e.preventDefault();
  cv.setPointerCapture(e.pointerId);
  drawing = true;
  const p = at(e);
  draw.strokes.push({ c: draw.ink, p: [p] });
  pending = [p];
  paintPoints(cv, draw.strokes[draw.strokes.length - 1]);
  clearInterval(flushTimer);
  flushTimer = window.setInterval(flush, 40);
});
app.addEventListener('pointermove', e => {
  const cv = pad(), stroke = draw.strokes[draw.strokes.length - 1];
  if (!drawing || e.target !== cv || !cv || !stroke) return;
  const p = at(e), last = stroke.p[stroke.p.length - 1];
  if (Math.hypot(p[0] - last[0], p[1] - last[1]) < .004) return;  // skip tiny moves: fewer points, smoother lines
  stroke.p.push(p);
  pending.push(p);
  paintPoints(cv, stroke, stroke.p.length - 1);
});
/** Repaints the whole drawing once the finger lifts, so lines look like on the TV (piece by piece they look bolder) */
const endStroke = () => { if (!drawing) return; drawing = false; clearInterval(flushTimer); flush(); paintStrokes(pad(), draw.strokes); };
app.addEventListener('pointerup', endStroke);
app.addEventListener('pointercancel', endStroke);
/** @param {'undo' | 'clear'} what */
function editDrawing(what) {
  endStroke();
  draw.strokes = what === 'undo' ? draw.strokes.slice(0, -1) : [];
  send({ type: what });
  paintStrokes(pad(), draw.strokes);
}
function aboutScreen() {
  const m = about.m;
  if (!m) return;
  if (about.k >= about.mine.length) return msg(t(about.mine.length ? 'all_done' : 'about_none'), t('wait_others'));
  const a = m.asks[about.mine[about.k]];
  show(`${hdr(t('about_you'), `${about.k + 1} / ${about.mine.length}`)}
    <p class="hint big">${esc(a.q)}</p>
    <div class="opts">${a.options.map((o, b) => `<button class="ans a${b}" data-action="mine" data-b="${b}">${shape(b, 34)}<span>${esc(o)}</span></button>`).join('')}</div>`, { plain: true });
}
/** @param {number} b */
function answerMine(b) {
  if (!about.m || about.k >= about.mine.length) return;
  send({ type: 'mine', i: about.mine[about.k], b });
  about.k++;
  aboutScreen();
}

/** @param {QuestionMsg} m */
function questionScreen(m) {
  answersAt = performance.now() + m.lock * 1000;
  ordered = [];
  const n = m.key?.length || 0;
  // Sort: items in this phone's own random order, so neighbours can't copy. Compare: the chain is the same for everyone
  const seq = [...Array(n).keys()];
  if (m.kind === 'sort') seq.sort(() => Math.random() - .5);
  run = { seq, k: 0, right: 0, busy: false };
  if (m.kind === 'draw' && m.subject?.name === me.name) drawScreen(m);
  else if (m.subject?.name === me.name) show(`${hdr(qNum(m))}<div class="center mid">${avatar(me, 120, 'pop')}
    <h1 class="title">${t('spotlight')}</h1><p class="muted" style="font-size:19px">${t('spotlight_sub')}</p></div>`);
  else if (m.kind === 'number') numberScreen(m);
  else if (m.kind === 'order') orderScreen(m);
  else if (isSprint(m.kind)) sprintScreen(m);
  else show(`${hdr(qNum(m), m.subject ? esc(m.subject.name) : roundLabel(m) || t('look_tv'))}
    <div class="opts${m.options.length === 2 ? ' two' : ''}${lock(m)}">${m.options.map((o, i) => `<button class="ans a${i}" data-action="answer" data-i="${i}">${shape(i, 34)}<span>${esc(o)}</span></button>`).join('')}</div>`, { plain: true });
}
/** @param {QuestionMsg} q @param {string} answer what was picked, already escaped @param {number} [i] colour and shape of a picked option */
function lockedIn(q, answer, i) {
  show(`${hdr(qNum(q))}
    <div class="center mid">
      ${i === undefined ? '' : `<div class="tile a${i} pop">${shape(i, 110)}</div>`}
      <h1 class="title">${t('locked')}</h1>
      <p style="font-size:24px;color:var(--mint)">${answer}</p>
      <p class="muted" style="font-size:18px">${t('wait_others')}</p></div>`, { plain: true });
}
/** @param {QuestionMsg} q @param {number} i */
function choose(q, i) {
  send({ type: 'answer', i, t: took() });
  lockedIn(q, esc(q.options[i]), i);
}

/** Closest number: type a guess @param {QuestionMsg} m */
function numberScreen(m) {
  show(`${hdr(qNum(m), roundLabel(m) || t('look_tv'))}
    <div class="center${lock(m)}">
      <label for="g">${t('your_guess')}</label>
      <div class="guess"><input id="g" inputmode="decimal" autocomplete="off" enterkeyhint="send">${m.unit ? `<span>${esc(m.unit)}</span>` : ''}</div>
      <button class="btn" data-action="guess">${t('send')}</button></div>`, { plain: true });
}
function guess() {
  const field = input('g'), q = cur;
  // Accept "1 234,5" as well as "1234.5"
  const v = Number((field?.value || '').replace(/[\s\u00a0]/g, '').replace(',', '.'));
  if (!q || !field?.value.trim() || !Number.isFinite(v)) return field?.focus();
  send({ type: 'answer', value: v, t: took() });
  lockedIn(q, `${num(v)}${q.unit ? ` ${esc(q.unit)}` : ''}`);
}

/** Order: tap the items first to last; tapping a numbered one takes it out again. The last one fills itself in. @param {QuestionMsg} m */
function orderScreen(m) {
  show(`${hdr(qNum(m), roundLabel(m) || t('look_tv'))}
    <p class="hint">${t('tap_order')}</p>
    <div class="opts${lock(m)}">${m.options.map((o, i) => {
      const pos = ordered.indexOf(i);
      return `<button class="ans a${i}${pos < 0 ? '' : ' on'}" data-action="order" data-i="${i}">${pos < 0 ? shape(i, 34) : `<b class="pos">${pos + 1}</b>`}<span>${esc(o)}</span></button>`;
    }).join('')}</div>
    <button class="btn" data-action="send_order"${ordered.length < 4 ? ' disabled' : ''}>${t('send')}</button>`, { plain: true });
}
/** @param {number} i */
function tapOrder(i) {
  if (!cur) return;
  const pos = ordered.indexOf(i);
  if (pos >= 0) ordered.splice(pos, 1);
  else ordered.push(i);
  if (pos < 0 && ordered.length === 3) ordered.push([0, 1, 2, 3].find(k => !ordered.includes(k)) ?? 0);
  orderScreen(cur);
}

/** Sprints: one pick at a time until the set is done. Sort: the item and its 2 buckets. Compare: the winner so far
 * (with its value once known) against the next item. @param {QuestionMsg} m @param {{ b: number, ok: boolean } | null} [fb] feedback on the last pick */
function sprintScreen(m, fb = null) {
  const key = m.key || [], n = key.length;
  if (run.k >= n) return show(`${hdr(qNum(m))}<div class="center mid"><h1 class="title pop">${t('all_done')}</h1>
    <div class="delta">${t('n_right', { n: run.right, total: n })}</div><p class="muted" style="font-size:18px">${t('wait_others')}</p></div>`, { plain: true });
  const i = run.seq[run.k], top = hdr(`${run.k + 1} / ${n}`, `✓ ${run.right}`);
  const mark = fb ? `<span class="mark">${fb.ok ? '✓' : '✗'}</span>` : '';
  if (m.kind === 'sort') {
    const item = /** @type {SortItem} */ ((m.items || [])[i]), buckets = m.buckets || [];
    return show(`${top}<p class="hint">${esc(m.text)}</p>
      <div class="item${fb ? (fb.ok ? ' ok' : ' bad') : ''}">${mark}<span>${esc(item.text)}</span></div>
      <div class="bkts${lock(m)}">${buckets.map((b, k) => `<button class="ans a${k ? 3 : 0}${fb && k !== item.bucket ? ' dim' : ''}" data-action="pick" data-b="${k}"><span>${esc(b)}</span></button>`).join('')}</div>`, { plain: true });
  }
  // Compare: pair i is the winner of pairs 0..i-1 against item i + 1
  const items = /** @type {CompareItem[]} */ (m.items || []);
  let w = 0;
  for (let k = 0; k < i; k++) if (key[k]) w = k + 1;
  const pair = [items[w], items[i + 1]];
  return show(`${top}<p class="hint big">${esc(m.text)}</p>
    <div class="opts two vs${lock(m)}">${pair.map((it, b) => {
      const shown = fb || (b === 0 && i > 0);  // the winner's value is known after the first pick
      const cls = fb ? (b === key[i] ? ' on' : ' dim') : '';
      return `<button class="ans a${b ? 3 : 0}${cls}" data-action="pick" data-b="${b}"><span>${esc(it.text)}${shown ? `<small>${esc(it.label)}</small>` : ''}</span>${fb && b === fb.b ? mark : ''}</button>`;
    }).join('')}</div>`, { plain: true });
}
/** @param {number} b */
function pick(b) {
  const m = cur;
  if (!m || run.busy || run.k >= (m.key?.length || 0)) return;
  const i = run.seq[run.k], ok = m.key?.[i] === b;
  send({ type: 'pick', i, b, t: took() });
  if (ok) run.right++;
  run.busy = true;
  sprintScreen(m, { b, ok });
  // Short flash for sort; compare shows both values a little longer
  setTimeout(() => { run.busy = false; run.k++; if (cur === m) sprintScreen(m); }, m.kind === 'compare' ? 1100 : 450);
}

/** @param {RevealMsg} m */
function result(m) {
  const y = m.you;
  if (!y) {
    show(`<div class="center mid"><h1 class="title">${t('round_over')}</h1><p class="muted" style="font-size:19px">${t('look_big')}</p>${holdBtn(m.wait)}</div>`);
    return allowHold(m.wait);
  }
  const kind = y.correct || (y.spotlight && y.right) ? 'correct' : y.answered || y.spotlight ? 'wrong' : 'slow';
  const icon = {
    correct: '<polyline points="4,12.5 9.5,18 20,6.5"/>',
    wrong: '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>',
    slow: '<circle cx="12" cy="12" r="9"/><polyline points="12,7 12,12 15.5,14"/>',
  }[kind];
  const lines = y.delta ? [t('points_delta', { n: num(y.delta) })] : [];
  if (m.kind === 'number' && m.answer !== undefined) lines.push(t('answer_was', { a: `${num(m.answer)}${m.unit ? ` ${esc(m.unit)}` : ''}` }));
  else if (!y.correct && !y.spotlight && cur && m.correct !== undefined) lines.push(t('answer_was', { a: esc(cur.options[m.correct]) }));
  const title = y.spotlight ? t(m.kind === 'draw' ? 'guessed_it' : 'known', { n: y.right ?? 0, total: y.of ?? 0 })
    : !y.answered ? t('slow')
    : m.kind === 'number' ? t(y.correct ? 'closest' : 'not_closest')
    : m.kind === 'order' && !y.correct ? t('placed', { n: y.placed ?? 0 })
    : isSprint(m.kind) ? t('n_right', { n: y.right ?? 0, total: y.of ?? 0 }) : t(kind);
  show(`<div class="hdr"><span>${cur ? qNum(cur) : ''}</span></div>
    <div class="center mid">
      <div class="badge pop"><svg width="50%" height="50%" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${icon}</svg></div>
      <h1 class="title" style="font-size:44px">${title}</h1>
      ${lines.map(l => `<div class="delta">${l}</div>`).join('')}
      ${y.correct && y.streak >= 3 ? `<div class="delta">🔥 ${t('in_a_row', { n: y.streak })}</div>` : ''}</div>
    <div class="stats"><div><small>${t('score')}</small><b>${num(y.score)}</b></div>
      <div><small>${t('rank')}</small><b>#${y.rank} / ${m.scores.length}</b></div></div>
    ${holdBtn(m.wait)}`, { mood: kind });
  allowHold(m.wait);
}

/** @param {ServerMsg} m */
function on(m) {
  localStorage.seen = Date.now();
  if (m.type === 'lobby') avatarsOn = m.settings.avatars;
  if (editing && m.type === 'lobby') { lobbyPlayers = m.players; return; }  // don't clobber the form
  if (m.type !== 'joined') editing = false;
  switch (m.type) {
    case 'joined':
      me = { name: m.name, avatar: m.avatar, color: m.color };  // the server may rename duplicates
      Object.assign(localStorage, me);
      break;
    case 'lobby':
      stopTimer();
      lobbyPlayers = m.players;
      lobbyScreen();
      break;
    case 'categories': startTimer(m.seconds); catForm(''); break;
    case 'vote': ballot = m; startTimer(m.seconds); voteScreen(m); break;
    case 'pick': {
      stopTimer();
      ballot = null;
      const tie = m.counts.filter(n => n === Math.max(...m.counts)).length > 1;
      show(`<div class="center mid"><p class="muted" style="font-size:18px">${roundLabel(m)}</p><h1 class="title pop">${esc(m.chosen)}</h1>
        <p class="muted" style="font-size:19px">${tie ? `${t('tie')}<br>` : ''}${t('k_' + m.kind)}</p></div>`);
      break;
    }
    case 'round_end': {
      const i = m.scores.findIndex(s => s.name === me.name);
      show(`<div class="center mid">${avatar(me, 120, 'pop')}<h1 class="title">${t('round_done', { n: m.round })}</h1>
        <p class="muted" style="font-size:19px">${i < 0 ? '' : `${t('standing', { rank: i + 1, score: num(m.scores[i].score) })}<br>`}${t('next_round', { n: m.round + 1, total: m.rounds })}</p>${holdBtn()}</div>`);
      break;
    }
    case 'category_ok': catForm(`${t('cat_sent', { text: `<b>${esc(m.text)}</b>` })}<br>${t('cat_change')}`); break;
    case 'generating':
      stopTimer();
      show(`<div class="center mid"><h1 class="title">${t('writing_q')}</h1>
        <div class="chips">${m.categories.map(c => `<span>${esc(c)}</span>`).join('')}</div></div>`);
      break;
    case 'ready':
      stopTimer();
      show(`<div class="center mid"><p class="muted" style="font-size:18px">${roundLabel(m)}</p><h1 class="title">${esc(m.category)}</h1>
        <p class="muted" style="font-size:19px">${roundSize(m)}</p><div class="note">${t('r_' + m.kind)}</div>${holdBtn()}</div>`);
      break;
    case 'about':
      startTimer(m.seconds);
      about = { m, mine: m.asks.flatMap((a, i) => a.subject.name === me.name ? [i] : []), k: 0 };
      aboutScreen();
      break;
    case 'question': cur = m; startTimer(m.seconds, m.lock); questionScreen(m); break;
    case 'reveal': stopTimer(); endStroke(); result(m); break;
    case 'secret': draw.word = m.word; { const el = $('word'); if (el) el.textContent = m.word; } break;
    case 'strokes': if (pad()) { draw.strokes = m.strokes; paintStrokes(pad(), draw.strokes); } break;
    case 'scores': {
      stopTimer();
      const i = m.scores.findIndex(s => s.name === me.name);
      const mine = (m.awards || []).filter(a => a.player?.name === me.name).map(a => `${esc(a.icon)} <b>${esc(a.title)}</b>`);
      lobbyScreen(t(m.final ? 'game_over' : 'round_over'), (i < 0 ? '' : t('you_are', { rank: i + 1, score: num(m.scores[i].score) }))
        + (mine.length ? `<br>${t('your_award', { list: mine.join(', ') })}` : ''));
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
    case 'edit': draft = { ...me }; joinForm(); break;
    case 'color': case 'avatar':
      draft = { ...draft, name: input('n')?.value.trim() || '', [b.dataset.action]: b.dataset.v || '' };
      joinForm();
      break;
    case 'category': sendCat(false); break;
    case 'surprise': sendCat(true); break;
    case 'vote':
      if (ballot) {
        send({ type: 'vote', i: Number(b.dataset.i) });
        voteScreen(ballot, Number(b.dataset.i));
      }
      break;
    case 'answer': if (cur && b === pressed) choose(cur, Number(b.dataset.i)); break;
    case 'guess': guess(); break;
    case 'order': if (b === pressed) tapOrder(Number(b.dataset.i)); break;
    case 'send_order': if (cur && ordered.length === 4) { send({ type: 'answer', order: ordered, t: took() }); lockedIn(cur, ordered.map(i => esc(cur?.options[i])).join(' → ')); } break;
    case 'pick': if (b === pressed) pick(Number(b.dataset.b)); break;
    case 'mine': if (b === pressed) answerMine(Number(b.dataset.b)); break;
    case 'ink':
      draw.ink = Number(b.dataset.i);
      app.querySelectorAll('.inkbtn').forEach(x => x.classList.toggle('on', x === b));
      break;
    case 'undo': case 'clear': editDrawing(b.dataset.action); break;
  }
});
/** Button the current touch started on: an answer only counts if the finger went down on it, not on the screen before */
let pressed = /** @type {Element | null} */ (null);
app.addEventListener('pointerdown', e => {
  pressed = /** @type {Element} */ (e.target).closest('[data-action]');
  const b = /** @type {HTMLElement | null} */ (/** @type {Element} */ (e.target).closest('[data-hold]'));
  if (!b || b.classList.contains('done') || b.hasAttribute('disabled')) return;
  b.setPointerCapture(e.pointerId);  // keep counting if the finger drifts off the button
  b.classList.add('on');
  holdTimer = window.setTimeout(() => {
    b.classList.replace('on', 'done');
    send({ type: 'continue' });
  }, HOLD_MS);
});
const release = () => { clearTimeout(holdTimer); app.querySelector('[data-hold].on')?.classList.remove('on'); };
app.addEventListener('pointerup', release);
app.addEventListener('pointercancel', release);
app.addEventListener('contextmenu', e => { if (/** @type {Element} */ (e.target).closest('[data-hold]')) e.preventDefault(); });  // long-press menu
// Keep the avatar preview's initial in sync with the typed name
app.addEventListener('input', e => {
  const el = /** @type {HTMLInputElement} */ (e.target), preview = $('preview');
  if (el.id !== 'n' || !preview) return;
  draft.name = el.value.trim();
  preview.innerHTML = avatar({ ...draft, name: draft.name || '?' }, 96);
  const initial = app.querySelector('.face[data-v=""]');
  if (initial) initial.textContent = [...(draft.name || '?')][0];
});
app.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const id = /** @type {Element} */ (e.target).id;
  if (id === 'n') join();
  if (id === 'c') sendCat(false);
  if (id === 'g') guess();
});

loadInfo().then(async i => {
  info = i;
  lobbyPlayers = i.players || [];
  avatarsOn = i.settings?.avatars ?? true;
  if (i.dev) {
    const dev = await import('./dev.js');
    if (dev.screen) me = dev.ME;  // sample identity, not saved
    if (dev.devBar('player', on)) return;  // previewing a screen offline
  }
  const avatars = i.avatars || [];
  if (!me.name && avatars.length) draft.avatar = pickFree(avatars, new Set(lobbyPlayers.map(p => p.avatar)));  // first visit
  updateFs();
  // Same game (e.g. page refresh): rejoin straight away. Otherwise offer the saved identity to confirm or change.
  if (me.name && recent) { msg(t('connecting')); keepAwake(); start(); }
  else joinForm();
});
