// @ts-check
// Dev bar (python main.py --dev only): preview any screen with sample data. While previewing, the page stays
// offline (no websocket, so clicks don't reach the server) and timers are frozen. The chosen screen is kept
// per tab in sessionStorage, so it survives a refresh; "Live" goes back to the real game.
import { stopTimer } from './common.js';

/** @typedef {import('./types').ServerMsg} ServerMsg */
/** @typedef {import('./types').Player} Player */
/** @typedef {import('./types').QuestionMsg} QuestionMsg */
/** @typedef {import('./types').RevealMsg} RevealMsg */

/** @type {Player[]} */
const PLAYERS = [
  { name: 'Ania', avatar: '🦊', color: '#FF8A80' }, { name: 'Kamil', avatar: '🐼', color: '#5EEAD4' },
  { name: 'Ola', avatar: '🐸', color: '#FFD166' }, { name: 'Tomek', avatar: '', color: '#93A8FF' },
];
/** The phone page's identity while previewing (not saved to localStorage) */
export const ME = PLAYERS[1];
const scores = PLAYERS.map((p, i) => ({ ...p, score: [4200, 3650, 2900, 1500][i], streak: [4, 1, 0, 2][i], best: [5, 3, 2, 2][i], correct: [8, 7, 6, 3][i] }));
const settings = { rounds: 3, per_round: 5, suggest_seconds: 90, category_seconds: 15, question_seconds: 60, avatars: true, ai_awards: false };
const options = { rounds: [1, 2, 3, 4, 5], per_round: [3, 5, 10, 15, 20], suggest_seconds: [30, 60, 90, 120], category_seconds: [5, 10, 15, 30], question_seconds: [10, 15, 20, 30, 45, 60] };
const rnd = { round: 2, rounds: 3 };
const cats = ['Space and astronomy', 'Movies of the 90s', 'Video games', 'Mythology'];
const by = [[PLAYERS[0]], [], [PLAYERS[2], PLAYERS[3]], []];
/** @type {ServerMsg} */
const categories = { type: 'categories', seconds: 90, players: 4 };
/** @type {ServerMsg} */
const sent = { type: 'cats', list: cats.slice(0, 3), submitted: 3, players: 4 };
/** @type {QuestionMsg} */
const question = { type: 'question', ...rnd, n: 3, total: 5, category: cats[0], text: 'Which planet has the most known moons?',
  options: ['Jupiter', 'Saturn', 'Uranus', 'Neptune'], seconds: 60 };
/** @type {RevealMsg} */
const reveal = { type: 'reveal', correct: 1, explanation: 'Saturn has over 140 confirmed moons.', counts: [2, 1, 0, 1], scores,
  you: { answered: true, correct: true, delta: 820, score: 3650, rank: 2, streak: 3 } };

/** Each screen is the messages the server would have sent to get there. @type {{ key: string, label: string, only?: 'host' | 'player', msgs: ServerMsg[] }[]} */
const SCREENS = [
  { key: 'setup', label: 'Setup', only: 'host', msgs: [{ type: 'setup', settings, options, players: 4 }] },
  { key: 'lobby', label: 'Lobby', msgs: [{ type: 'lobby', players: PLAYERS, settings }] },
  { key: 'categories', label: 'Suggest', msgs: [categories, sent] },
  { key: 'category_ok', label: 'Suggested', only: 'player', msgs: [categories, { type: 'category_ok', text: cats[2] }] },
  { key: 'preparing', label: 'Preparing', only: 'host', msgs: [categories, sent, { type: 'preparing' }] },
  { key: 'vote', label: 'Vote', msgs: [{ type: 'vote', ...rnd, options: cats, by, seconds: 15, total: 5, players: 4 }, { type: 'votes', voted: 2, players: 4 }] },
  { key: 'pick', label: 'Pick', msgs: [{ type: 'pick', ...rnd, options: cats, by, counts: [1, 0, 3, 0], chosen: cats[2], total: 5 }] },
  { key: 'generating', label: 'Generating', msgs: [{ type: 'generating', ...rnd, categories: [cats[0]], total: 5 }, { type: 'progress', done: 1, total: 2 }] },
  { key: 'ready', label: 'Ready', msgs: [{ type: 'ready', ...rnd, category: cats[0], total: 5 }] },
  { key: 'question', label: 'Question', msgs: [question, { type: 'answered', players: PLAYERS.map((p, i) => ({ ...p, done: i < 2 })) }] },
  { key: 'reveal', label: 'Reveal', msgs: [question, reveal] },
  { key: 'reveal_wrong', label: 'Reveal ✗', only: 'player', msgs: [question, { ...reveal, you: { answered: true, correct: false, delta: 0, score: 2830, rank: 3, streak: 0 } }] },
  { key: 'reveal_slow', label: 'Reveal ⏱', only: 'player', msgs: [question, { ...reveal, you: { answered: false, correct: false, delta: 0, score: 2830, rank: 3, streak: 0 } }] },
  { key: 'round_end', label: 'Round end', msgs: [{ type: 'round_end', ...rnd, scores }] },
  { key: 'final', label: 'Final', msgs: [{ type: 'scores', scores, final: true, questions: 15, awards: [
    { key: 'speed_demon', icon: '⚡', title: 'Speed demon', text: 'Ania answered in 1.2 s. Did she even read it?', player: PLAYERS[0] },
    { key: 'on_fire', icon: '🔥', title: 'On fire', text: 'Kamil got 5 in a row.', player: PLAYERS[1] },
    { key: 'brain_buster', icon: '🧠', title: 'Brain buster', text: 'Nobody knew who painted the Arnolfini Portrait.', player: null }] }] },
  { key: 'error', label: 'Error', msgs: [{ type: 'error', message: 'Claude did not return any usable questions.' }] },
];

const CSS = `#devbar{position:fixed;left:8px;right:8px;bottom:8px;z-index:100;display:flex;flex-wrap:wrap;gap:4px;padding:6px;
  background:rgba(0,0,0,.8);border-radius:8px;font:13px/1 system-ui,sans-serif}
#devbar.min{right:auto}#devbar.min button:not(.tog){display:none}
#devbar button{background:#333;color:#fff;border:0;border-radius:4px;padding:6px 8px;cursor:pointer;font:inherit}
#devbar button:hover{background:#555}#devbar button.on{background:#FFC83D;color:#000}#devbar .tog{background:#B42D31}`;

/** Screen previewed in this tab, '' when live */
export const screen = sessionStorage.devScreen || '';

/**
 * Add the dev bar and show the previewed screen, if any.
 * @param {'host' | 'player'} role
 * @param {(m: ServerMsg) => void} on the page's server message handler
 * @returns {boolean} true when previewing: the page should then not connect
 */
export function devBar(role, on) {
  const list = SCREENS.filter(s => !s.only || s.only === role);
  const bar = document.createElement('nav');
  bar.id = 'devbar';
  bar.classList.toggle('min', sessionStorage.devMin === '1');
  bar.innerHTML = `<style>${CSS}</style><button class="tog" title="Hide or show the dev bar">DEV</button>`
    + [{ key: '', label: 'Live' }, ...list].map(s => `<button data-dev="${s.key}"${s.key === screen ? ' class="on"' : ''}>${s.label}</button>`).join('');
  bar.addEventListener('click', e => {
    const b = /** @type {HTMLElement | null} */ (/** @type {Element} */ (e.target).closest('button'));
    if (!b) return;
    if (b.classList.contains('tog')) sessionStorage.devMin = bar.classList.toggle('min') ? '1' : '';
    else { sessionStorage.devScreen = b.dataset.dev; location.reload(); }  // reload drops the websocket and any page state
  });
  document.body.appendChild(bar);
  const cur = list.find(s => s.key === screen);
  if (!cur) return false;
  cur.msgs.forEach(on);
  stopTimer();
  return true;
}
