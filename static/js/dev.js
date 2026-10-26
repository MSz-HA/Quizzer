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
/** @type {import('./types').Settings} */
const settings = { rounds: 3, per_round: 5, suggest_seconds: 90, category_seconds: 15, question_seconds: 60, read_seconds: 2, reveal_seconds: 3, avatars: true,
  types: ['classic', 'odd', 'random', 'classic', 'classic', 'classic', 'classic', 'classic', 'classic', 'classic'] };
const types = /** @type {const} */ (['classic', 'odd', 'truefalse', 'number', 'order', 'sort', 'compare', 'about', 'draw', 'random']);
const options = { rounds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], per_round: [3, 5, 10, 15, 20], suggest_seconds: [30, 60, 90, 120], category_seconds: [5, 10, 15, 30], question_seconds: [10, 15, 20, 30, 45, 60], read_seconds: [1, 2, 3, 4, 5], reveal_seconds: [1, 3, 5, 7] };
const rnd = { round: 2, rounds: 3, kind: /** @type {const} */ ('classic') };
const cats = ['Space and astronomy', 'Movies of the 90s', 'Video games', 'Mythology'];
const by = [[PLAYERS[0]], [], [PLAYERS[2], PLAYERS[3]], []];
/** @type {ServerMsg} */
const categories = { type: 'categories', seconds: 90, players: 4 };
/** @type {ServerMsg} */
const sent = { type: 'cats', list: cats.slice(0, 3), submitted: 3, players: 4 };
/** @type {QuestionMsg} */
const question = { type: 'question', ...rnd, n: 3, total: 5, category: cats[0], text: 'Which planet has the most known moons?',
  options: ['Jupiter', 'Saturn', 'Uranus', 'Neptune'], unit: '', seconds: 60, lock: 0.6 };
/** @type {RevealMsg} */
const reveal = { type: 'reveal', kind: 'classic', correct: 1, explanation: 'Saturn has over 140 confirmed moons.', counts: [2, 1, 0, 1], scores, wait: 3,
  you: { answered: true, correct: true, delta: 820, score: 3650, rank: 2, streak: 3 } };
const you = { answered: true, correct: false, delta: 500, score: 3650, rank: 2, streak: 0 };
// One question and reveal per round type
/** @type {QuestionMsg} */
const qTf = { ...question, kind: 'truefalse', text: 'Venus spins in the opposite direction to most planets.', options: ['True', 'False'], seconds: 30 };
/** @type {QuestionMsg} */
const qNumber = { ...question, kind: 'number', text: 'How tall is Mount Everest?', options: [], unit: 'm' };
/** @type {QuestionMsg} */
const qOrder = { ...question, kind: 'order', text: 'From the closest to the Sun to the farthest', options: ['Mars', 'Venus', 'Neptune', 'Jupiter'] };
const sortItems = [['Gandalf', 1], ['Neo', 0], ['Hermione', 1], ['Ellen Ripley', 0], ['Sherlock Holmes', 1], ['Marty McFly', 0], ['Elizabeth Bennet', 1], ['The Terminator', 0]]
  .map(([text, bucket]) => ({ text: String(text), bucket: Number(bucket) }));
/** @type {QuestionMsg} */
const qSort = { ...question, n: 1, total: 1, kind: 'sort', text: 'Movie hero or book hero?', options: [], buckets: ['Movie', 'Book'], items: sortItems,
  key: sortItems.map(i => i.bucket) };
const films = [['Titanic', 1997], ['The Matrix', 1999], ['Jaws', 1975], ['Avatar', 2009], ['Star Wars', 1977], ['Psycho', 1960]]
  .map(([text, value]) => ({ text: String(text), value: Number(value), label: String(value) }));
/** @type {QuestionMsg} */
const qCompare = { ...question, n: 1, total: 1, kind: 'compare', text: 'Which came out first?', options: [], items: films, higher: false, key: [0, 1, 0, 1, 1] };
/** @type {ServerMsg[]} */
const progress = [{ type: 'answered', players: PLAYERS.map((p, i) => ({ ...p, done: i === 0, n: [8, 5, 2, 0][i] })) }];
const aboutRnd = { ...rnd, kind: /** @type {const} */ ('about') };
const pizza = ['Pizza', 'Sushi', 'Pasta', 'Burgers'];
/** @type {ServerMsg} */
const aboutMsg = { type: 'about', ...aboutRnd, seconds: 30, asks: [
  { subject: PLAYERS[1], q: 'What would you rather eat for the rest of your life?', options: pizza },
  { subject: PLAYERS[0], q: 'Which superpower would you pick?', options: ['Flying', 'Invisibility', 'Reading minds', 'Teleporting'] }] };
/** @type {QuestionMsg} */
const qAbout = { ...question, ...aboutRnd, category: 'Who knows them best', text: 'What would you rather eat for the rest of your life?', options: pizza, subject: PLAYERS[0] };
/** @type {QuestionMsg} */
const qDraw = { ...question, kind: 'draw', text: '', options: ['Jupiter', 'Saturn', 'Moon', 'Ball'], subject: PLAYERS[0] };
/** A quick sketch of Saturn: the planet and its ring @type {import('./types').Stroke[]} */
const saturn = [
  { c: 0, p: Array.from({ length: 41 }, (_, i) => /** @type {[number, number]} */ ([.5 + .17 * Math.cos(i / 40 * 2 * Math.PI), .5 + .22 * Math.sin(i / 40 * 2 * Math.PI)])) },
  { c: 1, p: Array.from({ length: 41 }, (_, i) => /** @type {[number, number]} */ ([.5 + .34 * Math.cos(i / 40 * 2 * Math.PI), .52 + .08 * Math.sin(i / 40 * 2 * Math.PI)])) },
];
const KIND_SCREENS = /** @type {{ key: string, label: string, only?: 'host' | 'player', msgs: ServerMsg[] }[]} */ ([
  { key: 'about', label: 'About me', msgs: [aboutMsg, { type: 'answered', players: PLAYERS.map((p, i) => ({ ...p, done: i % 2 === 0 })) }] },
  { key: 'q_about', label: 'Q About', msgs: [qAbout, { type: 'answered', players: PLAYERS.slice(1).map((p, i) => ({ ...p, done: i < 1 })) }] },
  { key: 'q_about_me', label: 'Q About me', only: 'player', msgs: [{ ...qAbout, subject: PLAYERS[1] }] },
  { key: 'r_about', label: 'R About', msgs: [qAbout, { type: 'reveal', kind: 'about', correct: 1, counts: [1, 2, 0, 0], explanation: '', scores, you: { ...you, correct: true, delta: 870 } }] },
  { key: 'q_draw', label: 'Q Draw', msgs: [qDraw, { type: 'strokes', strokes: saturn }, { type: 'answered', players: PLAYERS.slice(1).map((p, i) => ({ ...p, done: i < 1 })) }] },
  { key: 'q_draw_me', label: 'Q Draw me', only: 'player', msgs: [{ ...qDraw, subject: PLAYERS[1] }, { type: 'secret', word: 'Saturn' }, { type: 'strokes', strokes: saturn }] },
  { key: 'r_draw', label: 'R Draw', msgs: [qDraw, { type: 'reveal', kind: 'draw', correct: 1, counts: [1, 2, 0, 0], strokes: saturn, wait: 3,
    explanation: "Saturn's rings are only tens of metres thick.", scores, you: { ...you, correct: true, delta: 910 } }] },
  { key: 'r_about_me', label: 'R About me', only: 'player', msgs: [{ ...qAbout, subject: PLAYERS[1] }, { type: 'reveal', kind: 'about', correct: 1, counts: [1, 2, 0, 0], explanation: '', scores,
    you: { ...you, answered: false, delta: 666, spotlight: true, right: 2, of: 3 } }] },
  { key: 'q_tf', label: 'Q T/F', msgs: [qTf] },
  { key: 'r_tf', label: 'R T/F', msgs: [qTf, { type: 'reveal', kind: 'truefalse', correct: 0, explanation: 'A day on Venus is longer than its year, too.', counts: [3, 1], scores, you: { ...you, correct: true, delta: 910 } }] },
  { key: 'q_number', label: 'Q 123', msgs: [qNumber] },
  { key: 'r_number', label: 'R 123', msgs: [qNumber, { type: 'reveal', kind: 'number', answer: 8849, unit: 'm', explanation: 'Measured again in 2020.', scores, you: { ...you, value: 8000 },
    guesses: PLAYERS.map((p, i) => ({ ...p, value: [8849, 8000, 9500, 5000][i], delta: [1500, 750, 500, 250][i] })) }] },
  { key: 'q_order', label: 'Q 1234', msgs: [qOrder] },
  { key: 'r_order', label: 'R 1234', msgs: [qOrder, { type: 'reveal', kind: 'order', order: [1, 0, 3, 2], values: ['108 mln km', '228 mln km', '778 mln km', '4.5 bln km'], placed: [3, 2, 4, 4], explanation: 'Venus is the second planet from the Sun.', scores, you: { ...you, placed: 2 } }] },
  { key: 'q_sort', label: 'Q Sort', msgs: [qSort, ...progress] },
  { key: 'r_sort', label: 'R Sort', msgs: [qSort, { type: 'reveal', kind: 'sort', right: [4, 4, 3, 1, 4, 2, 1, 4], players: 4, explanation: 'Gandalf did get films, but he started in a book.', scores, you: { ...you, correct: true, delta: 3800, right: 7, of: 8 } }] },
  { key: 'q_compare', label: 'Q Cmp', msgs: [qCompare, ...progress] },
  { key: 'r_compare', label: 'R Cmp', msgs: [qCompare, { type: 'reveal', kind: 'compare', right: [4, 3, 1, 4, 2], players: 4, explanation: 'Psycho is the oldest of them all.', scores, you: { ...you, right: 3, of: 5 } }] },
]);

/** Each screen is the messages the server would have sent to get there. @type {{ key: string, label: string, only?: 'host' | 'player', msgs: ServerMsg[] }[]} */
const SCREENS = [
  { key: 'setup', label: 'Setup', only: 'host', msgs: [{ type: 'setup', settings, options, types: [...types], players: 4 }] },
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
  ...KIND_SCREENS,
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
