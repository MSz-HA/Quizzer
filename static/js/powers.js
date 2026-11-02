// @ts-check
// Power-up attacks on the phone's answer screens (see POWERS in main.py). Gloop and bombs are layers in #fx above the
// page, so they survive the screen being redrawn (sprints redraw after every pick); freeze's ice follows the answers. Letter thief and spin
// change how answer texts are drawn: mask() and the data-spin attribute on <body> (styles in player.css).
import { $, esc, send } from './common.js';

/** @typedef {import('./types').PowerRow} PowerRow */

const FREEZE_S = 3;     // per stack, at most half the answer time
const BOOM_S = 2;       // stuck after touching a bomb
const BOMBS = 2;        // per stack
const STAINS = 3;       // ink stains per stack
const LETTERS = .3;     // share of letters gone per stack...
const MAX_LETTERS = .85; // ...up to this much
const WIPE = 44;        // finger width when wiping ink, in CSS pixels

/** Attacks on this player this round: power -> stacks @type {Record<string, number>} */
let fx = {};
let freezeFor = 0, raf = 0, iceRaf = 0;
/** Floating bombs: element, position, speed and size in CSS pixels @type {{ el: HTMLElement, x: number, y: number, vx: number, vy: number, size: number }[]} */
let bombs = [];
const layer = () => /** @type {HTMLElement} */ ($('fx'));
const ink = () => /** @type {HTMLCanvasElement | null} */ (layer().querySelector('canvas'));

/** Take this player's attacks from the round's power rows. @param {PowerRow[] | undefined} rows @param {string} name */
export function setEffects(rows, name) {
  fx = {};
  for (const g of rows?.find(r => r.player.name === name)?.got || []) if (g.power !== 'double' && g.power !== 'bet') fx[g.power] = (fx[g.power] || 0) + 1;
  document.body.dataset.spin = String(Math.min(3, fx.spin || 0));
}

/** An answer text, escaped, with letters taken out by the letter thief. The same text always loses the same letters,
 * so it doesn't change when the screen is redrawn. @param {string} text */
export function mask(text) {
  if (!fx.dziobaki) return esc(text);
  const chars = [...text], letters = chars.flatMap((c, i) => /[\p{L}\p{N}]/u.test(c) ? [i] : []);
  const k = Math.min(letters.length - 1, Math.round(letters.length * Math.min(MAX_LETTERS, LETTERS * fx.dziobaki)));
  const gone = new Set(letters.sort((a, b) => hash(text + a) - hash(text + b)).slice(0, k));
  return esc(chars.map((c, i) => gone.has(i) ? '_' : c).join(''));
}
/** @param {string} s */
const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ (c.codePointAt(0) || 0), 16777619); return h >>> 0; };

/** Start the attacks for a question. @param {number} at performance.now() when the answers show @param {number} seconds answer time */
export function startEffects(at, seconds) {
  stopEffects();
  freezeFor = Math.min(FREEZE_S * (fx.freeze || 0), seconds / 2);
  if (freezeFor) freeze(at);
  if (fx.gloop) splat(STAINS * fx.gloop);
  if (fx.bombs) addBombs(BOMBS * fx.bombs);
}
/** Sprints: freeze again and splash more ink every few picks, since a sprint is one long question */
export function burst() {
  if (freezeFor) freeze(performance.now());
  if (fx.gloop) splat(STAINS * fx.gloop);
}
export function stopEffects() {
  cancelAnimationFrame(raf);
  thaw();
  bombs = [];
  layer().innerHTML = '';
  document.body.classList.remove('gloop');
}

// ---- Freeze: answers iced over and untappable. Cracks spread through the ice one by one over freezeFor seconds, then
// it shatters and the answers get their colours back. The ice is in #fx above the ink and follows the answers, and
// while it's there the ink can't be wiped and the bombs don't go off: the other attacks wait for it to melt ----
const CRACKS = 6;      // lines from the impact point, one after another, each snapping on a piece at a time
const CRACK_STEP = .03; // share of the freeze between pieces of a line
/** Ice over each answer: the answer it covers, and its crack pieces with when each appears (share of the freeze)
 * @type {{ ans: Element, el: HTMLElement, cracks: { el: SVGElement, at: number }[] }[]} */
let ice = [];
let iceAt = 0;
const frozen = () => document.body.classList.contains('frozen');

/** @param {number} at performance.now() when the answers show and the cracking starts */
function freeze(at) {
  thaw();
  iceAt = at;
  document.body.classList.add('frozen');
  /** @param {number} now */
  const step = now => {
    const p = (now - at) / (freezeFor * 1000);
    if (p >= 1) return thaw(true);
    if (p >= 0) iceAll(p);  // before that the answers are still hidden
    iceRaf = requestAnimationFrame(step);
  };
  iceRaf = requestAnimationFrame(step);
}
/** @param {boolean} shatter whether the ice breaks off (the freeze ran out) or just goes (the screen moved on) */
function thaw(shatter = false) {
  cancelAnimationFrame(iceRaf);
  document.body.classList.remove('frozen');
  for (const { el } of ice) {
    if (!shatter) { el.remove(); continue; }
    el.classList.add('shatter');
    setTimeout(() => el.remove(), 300);
  }
  ice = [];
}
/** Keep a pane of ice over each answer (new panes when the answers are redrawn: sprints redraw after each pick's
 * feedback) and show the cracks due by p @param {number} p share of the freeze gone */
function iceAll(p) {
  const answers = [...document.querySelectorAll('#app .ans')];
  if (answers.length !== ice.length || answers.some((a, i) => ice[i].ans !== a)) {
    for (const { el } of ice) el.remove();
    ice = answers.map((ans, i) => {
      const r = ans.getBoundingClientRect(), el = document.createElement('div');
      el.className = 'ice';
      el.style.borderRadius = getComputedStyle(ans).borderRadius;
      el.innerHTML = `<svg viewBox="0 0 ${r.width} ${r.height}">${crackPaths(i, r.width, r.height)}</svg>`;
      layer().append(el);
      return { ans, el, cracks: [...el.querySelectorAll('line, path')].map(c => ({ el: /** @type {SVGElement} */ (c), at: Number(/** @type {SVGElement} */ (c).dataset.at) })) };
    });
  }
  for (const { ans, el, cracks } of ice) {
    const r = ans.getBoundingClientRect();
    Object.assign(el.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    for (const c of cracks) if (p >= c.at) c.el.classList.add('on');
  }
}
/** Jagged lines out from an impact point, in pieces, then a ring joining them. Seeded by the answer and the freeze, so
 * a redrawn answer gets the same cracks @param {number} i @param {number} w @param {number} h */
function crackPaths(i, w, h) {
  let seed = (i + 1) * 7919 + Math.round(iceAt);
  const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 2 ** 32; };
  const m = Math.min(w, h), x0 = w * (.2 + rnd() * .6), y0 = h * (.25 + rnd() * .5), ring = [];
  let html = '';
  for (let k = 0; k < CRACKS; k++) {
    let a = (k + rnd() * .6) / CRACKS * 2 * Math.PI, x = x0, y = y0;
    for (let n = 0; x > 0 && x < w && y > 0 && y < h && n < 14; n++) {
      a += (rnd() - .5) * .8;
      const x1 = x + Math.cos(a) * m * (.12 + rnd() * .14), y1 = y + Math.sin(a) * m * (.12 + rnd() * .14);
      html += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" data-at="${(k / CRACKS * .7 + n * CRACK_STEP).toFixed(3)}"/>`;
      [x, y] = [x1, y1];
      if (n === 1) ring.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
    }
  }
  return html + `<path d="M${ring.join(' L')} Z" data-at=".85"/>`;
}

// ---- Gloop: ink stains on a canvas over the answer texts. Dragging a finger wipes them; a tap still answers ----
/** @param {number} n */
function splat(n) {
  let cv = ink();
  if (!cv) {
    cv = document.createElement('canvas');
    const dpr = devicePixelRatio || 1;
    cv.width = innerWidth * dpr;
    cv.height = innerHeight * dpr;
    layer().prepend(cv);
    document.body.classList.add('gloop');
  }
  const ctx = /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d')), dpr = devicePixelRatio || 1, m = Math.min(innerWidth, innerHeight);
  const rnd = (/** @type {number} */ a, /** @type {number} */ b) => a + Math.random() * (b - a);
  // Aim at the answer texts, each stain on a different one while there are enough. Big, well past the text: the texts are
  // always in the same place, so a small stain is easy to wipe off just where it matters
  const texts = [...document.querySelectorAll('#app .fxt')].map(el => el.getBoundingClientRect()).filter(r => r.width && r.height)
    .sort(() => Math.random() - .5);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#160B2E';
  for (let i = 0; i < n; i++) {
    const t = texts[i % texts.length];
    const [x, y, r] = t ? [rnd(t.left + t.width * .3, t.right - t.width * .3), t.top + t.height / 2, Math.min(m * .38, Math.max(m * .24, t.height * 2.2, t.width * .6))]
      : [rnd(.1, .9) * innerWidth, rnd(.25, .92) * innerHeight, rnd(.14, .22) * m];  // no texts found: anywhere over the answers
    blob(ctx, x * dpr, y * dpr, r * dpr, rnd);
  }
}
/** An ink blob with lobes and splashes around it @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y
 * @param {number} r @param {(a: number, b: number) => number} rnd */
function blob(ctx, x, y, r, rnd) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  for (let k = 0; k < 9; k++) {
    const a = rnd(0, 2 * Math.PI), d = r * rnd(.7, 1.5), s = r * rnd(.12, .45);
    ctx.moveTo(x + Math.cos(a) * d + s, y + Math.sin(a) * d);
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, s, 0, 2 * Math.PI);
  }
  ctx.fill();
}
/** The current touch, while it may be a wipe @type {{ x: number, y: number, moved: boolean } | null} */
let touch = null;
/** Whether the last touch was a wipe (a drag), so it doesn't also count as a tap on an answer */
export const wiped = () => !!touch?.moved;
addEventListener('pointerdown', e => { touch = ink() ? { x: e.clientX, y: e.clientY, moved: false } : null; }, true);
addEventListener('pointermove', e => {
  const cv = ink();
  if (!touch || !cv || frozen() || !e.buttons && e.pointerType === 'mouse') return;
  if (!touch.moved && Math.hypot(e.clientX - touch.x, e.clientY - touch.y) < 10) return;
  touch.moved = true;
  const ctx = /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d')), dpr = devicePixelRatio || 1;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineCap = 'round';
  ctx.lineWidth = WIPE * dpr;
  ctx.beginPath();
  ctx.moveTo(touch.x * dpr, touch.y * dpr);
  ctx.lineTo(e.clientX * dpr, e.clientY * dpr);
  ctx.stroke();
  touch.x = e.clientX;
  touch.y = e.clientY;
  // A finger wiping ink over a bomb sets it off (the bomb doesn't get the touch itself: it started on the ink)
  const hit = bombs.find(b => Math.hypot(e.clientX - b.x - b.size / 2, e.clientY - b.y - b.size / 2) < b.size * .45);
  if (hit) boom(hit);
}, true);

// ---- Bombs: float around and bounce off the edges; touching one blows up the screen for BOOM_S ----
/** @param {number} n */
function addBombs(n) {
  const size = Math.min(innerWidth, innerHeight) * .16, speed = Math.min(innerWidth, innerHeight) * .64;
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div'), a = Math.random() * 2 * Math.PI;
    el.className = 'bomb';
    el.textContent = '💣';
    el.style.fontSize = `${size}px`;
    el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); boom(b); });
    const b = { el, x: Math.random() * (innerWidth - size), y: Math.random() * (innerHeight - size), vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, size };
    bombs.push(b);
    layer().append(el);
  }
  let last = performance.now();
  /** @param {number} now */
  const step = now => {
    const dt = Math.min(.05, (now - last) / 1000), w = innerWidth - size, h = innerHeight - size;
    last = now;
    for (const b of bombs) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < 0 || b.x > w) { b.vx = -b.vx; b.x = Math.max(0, Math.min(w, b.x)); }
      if (b.y < 0 || b.y > h) { b.vy = -b.vy; b.y = Math.max(0, Math.min(h, b.y)); }
      b.el.style.transform = `translate(${b.x}px,${b.y}px)`;
    }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}
/** @param {{ x: number, y: number }} b the bomb touched; it jumps somewhere else */
function boom(b) {
  if (frozen() || layer().querySelector('.boom')) return;
  send({ type: 'boom' });
  navigator.vibrate?.(300);
  b.x = Math.random() * innerWidth * .8;
  b.y = Math.random() * innerHeight * .8;
  const el = document.createElement('div');
  el.className = 'boom';
  el.style.animationDuration = `${BOOM_S}s`;
  el.innerHTML = '<span>💥</span>';
  layer().append(el);
  setTimeout(() => el.remove(), BOOM_S * 1000);
}
