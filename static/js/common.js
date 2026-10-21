// @ts-check
// Shared helpers for the TV (host.js) and phone (player.js) pages
/** @typedef {import('./types').Info} Info */
/** @typedef {import('./types').ServerMsg} ServerMsg */
/** @typedef {import('./types').ClientMsg} ClientMsg */
/** @typedef {import('./types').Player} Player */

/** @param {unknown} s */
export const esc = s => String(s).replace(/[&<>"']/g, c => /** @type {Record<string, string>} */ ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** @param {string} id */
export const $ = id => document.getElementById(id);

// ---- UI strings (language follows QUIZ_LANGUAGE via /api/info) ----
/** @type {Record<'en' | 'pl', Record<string, string>>} */
const STRINGS = {
  en: {
    connecting: 'Connecting…', reconnecting: 'Reconnecting…', fullscreen: 'Fullscreen',
    tagline: 'Party quiz · questions written by Claude', scan: 'Scan to join',
    wifi: "Same Wi-Fi as the TV · open in your phone's browser", players: 'Players', joined: '{n} joined',
    waiting_players: 'Waiting for players…', how_many: 'How many questions?', start: 'Start game',
    round_setup: 'Round setup · {n} questions', pick_cat: 'Pick a category on your phone',
    mixed: 'Questions are mixed from every category', sent_n: '{n} of {total} sent',
    writing: 'Claude is writing {n} questions about', batches: '{n} of {total} batches ready',
    qn: 'Question {n} of {total}', answered: '{n} of {total} answered', leaderboard: 'Leaderboard',
    final: 'Final scores', final_sub: '{q} questions · {p} players', play_again: 'Play again',
    error: 'Something went wrong', back_lobby: 'Back to lobby',
    tap_fs: 'Tap for fullscreen', tap_fs_sub: 'Hides the browser bars during the game',
    ios_fs: 'Play fullscreen', ios_fs_sub: 'Tap Share, then Add to Home Screen', dismiss: 'Dismiss',
    your_name: 'Your name', join: 'Join game', controller: 'Keep this page open, your phone is the controller',
    youre_in: "You're in, {name}!", wait_host: 'Waiting for the host to start.', n_players: '{n} players in the lobby',
    suggest: 'Suggest a category', suggest_hint: 'Anything you like, for example "90s cartoons" or "Polish cities".',
    category: 'Category', send: 'Send', surprise: 'Surprise me',
    cat_sent: 'Sent: {text}', cat_change: 'You can change it until time runs out.', writing_q: 'Writing questions…',
    look_tv: 'Look at the TV', locked: 'Answer locked in', wait_others: 'Waiting for the others…',
    correct: 'Correct!', wrong: 'Not this time', slow: 'Too slow', points_delta: '+{n} points',
    answer_was: 'Answer: {a}', score: 'Score', rank: 'Rank', round_over: 'Round over',
    look_big: 'Look at the big screen.', game_over: 'Game over', you_are: 'You finished #{rank} with {score} points',
    hold_on: 'Hold on', edit_look: 'Change name or look', edit_name: 'Change name', color: 'Colour', avatar: 'Avatar', initial: 'Initial',
    save: 'Save', in_a_row: '{n} in a row', wins: '{name} wins!',
    win_sub: '{score} points · {correct} of {total} correct · longest streak {best}',
  },
  pl: {
    connecting: 'Łączenie…', reconnecting: 'Ponowne łączenie…', fullscreen: 'Pełny ekran',
    tagline: 'Quiz na imprezę · pytania pisze Claude', scan: 'Zeskanuj, aby dołączyć',
    wifi: 'Ta sama sieć Wi-Fi co telewizor · otwórz w przeglądarce telefonu', players: 'Gracze', joined: 'Dołączyło: {n}',
    waiting_players: 'Czekamy na graczy…', how_many: 'Ile pytań?', start: 'Zaczynamy',
    round_setup: 'Przygotowanie · pytań: {n}', pick_cat: 'Wybierz kategorię na telefonie',
    mixed: 'Pytania będą ze wszystkich kategorii', sent_n: 'Wysłano: {n} z {total}',
    writing: 'Claude pisze {n} pytań o', batches: 'Gotowe partie: {n} z {total}',
    qn: 'Pytanie {n} z {total}', answered: 'Odpowiedziało: {n} z {total}', leaderboard: 'Ranking',
    final: 'Wyniki końcowe', final_sub: 'Pytań: {q} · Graczy: {p}', play_again: 'Zagraj ponownie',
    error: 'Coś poszło nie tak', back_lobby: 'Wróć do lobby',
    tap_fs: 'Dotknij, aby włączyć pełny ekran', tap_fs_sub: 'Ukrywa paski przeglądarki podczas gry',
    ios_fs: 'Graj na pełnym ekranie', ios_fs_sub: 'Stuknij Udostępnij, potem „Do ekranu początkowego”', dismiss: 'Zamknij',
    your_name: 'Twoje imię', join: 'Dołącz', controller: 'Nie zamykaj tej strony, telefon jest kontrolerem',
    youre_in: 'Jesteś w grze, {name}!', wait_host: 'Czekamy, aż prowadzący zacznie.', n_players: 'Graczy w lobby: {n}',
    suggest: 'Zaproponuj kategorię', suggest_hint: 'Cokolwiek chcesz, np. „bajki z lat 90.” albo „polskie miasta”.',
    category: 'Kategoria', send: 'Wyślij', surprise: 'Zaskocz mnie',
    cat_sent: 'Wysłano: {text}', cat_change: 'Możesz ją zmienić do końca czasu.', writing_q: 'Piszemy pytania…',
    look_tv: 'Patrz na telewizor', locked: 'Odpowiedź zapisana', wait_others: 'Czekamy na pozostałych…',
    correct: 'Dobrze!', wrong: 'Tym razem nie', slow: 'Za wolno', points_delta: '+{n} pkt',
    answer_was: 'Odpowiedź: {a}', score: 'Wynik', rank: 'Miejsce', round_over: 'Koniec rundy',
    look_big: 'Spójrz na duży ekran.', game_over: 'Koniec gry', you_are: 'Zajmujesz {rank}. miejsce, {score} pkt',
    hold_on: 'Chwileczkę', edit_look: 'Zmień imię lub wygląd', edit_name: 'Zmień imię', color: 'Kolor', avatar: 'Awatar', initial: 'Inicjał',
    save: 'Zapisz', in_a_row: '{n} z rzędu', wins: '{name} wygrywa!',
    win_sub: '{score} pkt · poprawne: {correct} z {total} · najdłuższa seria: {best}',
  },
};
/** @type {'en' | 'pl'} */
let LANG = 'en';
/**
 * Translated UI string. Values are inserted as-is: escape user text before passing it in.
 * @param {string} key
 * @param {Record<string, string | number>} [vars]
 */
export const t = (key, vars = {}) => (STRINGS[LANG][key] ?? STRINGS.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
/** @param {number} n */
export const num = n => n.toLocaleString(LANG === 'pl' ? 'pl-PL' : 'en-US');

/** Fetch join URL, QR code and UI language. @returns {Promise<Partial<Info>>} */
export function loadInfo() {
  return fetch('/api/info').then(r => r.json()).catch(() => ({})).then(/** @param {Partial<Info>} i */ i => {
    if (i.lang && STRINGS[i.lang]) LANG = i.lang;
    document.documentElement.lang = LANG;
    return i;
  });
}

// ---- Answer shapes (▲ ◆ ● ■) so colours are never the only cue ----
const SHAPES = [
  '<polygon points="12,3 22,21 2,21"/>', '<polygon points="12,1.5 22.5,12 12,22.5 1.5,12"/>',
  '<circle cx="12" cy="12" r="10"/>', '<rect x="3" y="3" width="18" height="18" rx="2.5"/>',
];
/** @param {number} i @param {number} size */
export const shape = (i, size) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${SHAPES[i]}</svg>`;

// ---- Player avatars: emoji (or the name's initial) on the player's colour ----
/** @param {Player} p @param {number} size @param {string} [extra] additional classes */
export function avatar(p, size, extra = '') {
  const scale = p.avatar ? .6 : .46;
  return `<div class="avatar ${extra}" style="width:${size}px;height:${size}px;font-size:${Math.round(size * scale)}px;background:${esc(p.color)}">${esc(p.avatar || [...p.name][0] || '?')}</div>`;
}

// ---- Countdown: paints every [data-t] (seconds), [data-bar] (width) and [data-ring] (SVG stroke) ----
const clock = { end: 0, total: 1, h: 0 };
/** @param {number} seconds */
export function startTimer(seconds) {
  clock.end = Date.now() + seconds * 1000;
  clock.total = seconds;
  clearInterval(clock.h);
  clock.h = window.setInterval(paintTimer, 250);
  paintTimer();
}
export function stopTimer() { clearInterval(clock.h); }
export function paintTimer() {
  const left = Math.max(0, (clock.end - Date.now()) / 1000), f = left / clock.total, s = Math.ceil(left);
  document.querySelectorAll('[data-t]').forEach(e => {
    e.textContent = /** @type {HTMLElement} */ (e).dataset.t === 'mmss' ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : String(s);
  });
  document.querySelectorAll('[data-bar]').forEach(e => { /** @type {HTMLElement} */ (e).style.width = f * 100 + '%'; });
  document.querySelectorAll('[data-ring]').forEach(e => {
    const c = /** @type {SVGElement} */ (e);
    c.style.strokeDashoffset = String(Number(c.dataset.ring) * (1 - f));
  });
}

// ---- Websocket with automatic reconnect and a "Reconnecting…" pill ----
/** @type {WebSocket | undefined} */
let ws;
/** @param {ClientMsg} o */
export const send = o => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };
/**
 * @param {'host' | 'player'} role
 * @param {(m: ServerMsg) => void} onMessage
 * @param {() => void} [onOpen]
 */
export function connect(role, onMessage, onOpen) {
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws?role=' + role);
  ws.onopen = () => { setConn(true); if (onOpen) onOpen(); };
  ws.onmessage = e => onMessage(JSON.parse(e.data));
  ws.onclose = () => { setConn(false); setTimeout(() => connect(role, onMessage, onOpen), 1500); };
}
/** @param {boolean} ok */
function setConn(ok) {
  let pill = $('conn');
  if (!pill) {
    pill = document.createElement('div');
    pill.id = 'conn';
    pill.setAttribute('role', 'status');
    document.body.appendChild(pill);
  }
  pill.textContent = t('reconnecting');
  pill.hidden = ok;
}

// ---- Fullscreen (must be called from a tap/click) ----
// webkit-prefixed variants are for older Safari on iPad
const doc = /** @type {any} */ (document);
export const fsSupported = () => !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
export const isFullscreen = () => !!(doc.fullscreenElement || doc.webkitFullscreenElement);
export function goFullscreen() {
  const el = /** @type {any} */ (document.documentElement);
  if (!fsSupported() || isFullscreen()) return;
  const p = (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
  if (p && p.catch) p.catch(() => {});
}
