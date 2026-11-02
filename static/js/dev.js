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
const settings = { rounds: 3, per_round: 5, suggest_seconds: 90, category_seconds: 15, question_seconds: 60, read_seconds: 2, reveal_seconds: 3, easy_share: 60, speed_window: 8, avatars: true, adult: false, powerups: true,
  types: ['classic', 'odd', 'random', 'classic', 'classic', 'classic', 'classic', 'classic', 'classic', 'classic'] };
const types = /** @type {const} */ (['classic', 'odd', 'truefalse', 'number', 'order', 'sort', 'compare', 'about', 'draw', 'random']);
const options = { rounds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], per_round: [3, 5, 10, 15, 20], suggest_seconds: [30, 60, 90, 120], category_seconds: [5, 10, 15, 30], question_seconds: [10, 15, 20, 30, 45, 60], read_seconds: [1, 2, 3, 4, 5], reveal_seconds: [1, 3, 5, 7], easy_share: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100], speed_window: [4, 6, 8, 10, 15, 20] };
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
  { key: 'about', label: 'Who knows them best: answering about yourself', msgs: [aboutMsg, { type: 'answered', players: PLAYERS.map((p, i) => ({ ...p, done: i % 2 === 0 })) }] },
  { key: 'q_about', label: 'Who knows them best: question', msgs: [qAbout, { type: 'answered', players: PLAYERS.slice(1).map((p, i) => ({ ...p, done: i < 1 })) }] },
  { key: 'q_about_me', label: 'Who knows them best: question about you', only: 'player', msgs: [{ ...qAbout, subject: PLAYERS[1] }] },
  { key: 'r_about', label: 'Who knows them best: answer', msgs: [qAbout, { type: 'reveal', kind: 'about', correct: 1, counts: [1, 2, 0, 0], explanation: '', scores, you: { ...you, correct: true, delta: 870 } }] },
  { key: 'q_draw', label: 'Pictionary: guessing', msgs: [qDraw, { type: 'strokes', strokes: saturn }, { type: 'answered', players: PLAYERS.slice(1).map((p, i) => ({ ...p, done: i < 1 })) }] },
  { key: 'q_draw_me', label: 'Pictionary: drawing', only: 'player', msgs: [{ ...qDraw, subject: PLAYERS[1] }, { type: 'secret', word: 'Saturn' }, { type: 'strokes', strokes: saturn }] },
  { key: 'r_draw', label: 'Pictionary: answer', msgs: [qDraw, { type: 'reveal', kind: 'draw', correct: 1, counts: [1, 2, 0, 0], strokes: saturn, wait: 3,
    explanation: "Saturn's rings are only tens of metres thick.", scores, you: { ...you, correct: true, delta: 910 } }] },
  { key: 'r_about_me', label: 'Who knows them best: answer about you', only: 'player', msgs: [{ ...qAbout, subject: PLAYERS[1] }, { type: 'reveal', kind: 'about', correct: 1, counts: [1, 2, 0, 0], explanation: '', scores,
    you: { ...you, answered: false, delta: 666, spotlight: true, right: 2, of: 3 } }] },
  { key: 'q_tf', label: 'True/false: question', msgs: [qTf] },
  { key: 'r_tf', label: 'True/false: answer', msgs: [qTf, { type: 'reveal', kind: 'truefalse', correct: 0, explanation: 'A day on Venus is longer than its year, too.', counts: [3, 1], scores, you: { ...you, correct: true, delta: 910 } }] },
  { key: 'q_number', label: 'Number: question', msgs: [qNumber] },
  { key: 'r_number', label: 'Number: answer', msgs: [qNumber, { type: 'reveal', kind: 'number', answer: 8849, unit: 'm', explanation: 'Measured again in 2020.', scores, you: { ...you, value: 8000 },
    guesses: PLAYERS.map((p, i) => ({ ...p, value: [8849, 8000, 9500, 5000][i], delta: [1500, 750, 500, 250][i] })) }] },
  { key: 'q_order', label: 'Order: question', msgs: [qOrder] },
  { key: 'r_order', label: 'Order: answer', msgs: [qOrder, { type: 'reveal', kind: 'order', order: [1, 0, 3, 2], values: ['108 mln km', '228 mln km', '778 mln km', '4.5 bln km'], placed: [3, 2, 4, 4], explanation: 'Venus is the second planet from the Sun.', scores, you: { ...you, placed: 2 } }] },
  { key: 'q_sort', label: 'Sort: sprint', msgs: [qSort, ...progress] },
  { key: 'r_sort', label: 'Sort: results', msgs: [qSort, { type: 'reveal', kind: 'sort', right: [4, 4, 3, 1, 4, 2, 1, 4], players: 4, explanation: 'Gandalf did get films, but he started in a book.', scores, you: { ...you, correct: true, delta: 3800, right: 7, of: 8 } }] },
  { key: 'q_compare', label: 'Compare: sprint', msgs: [qCompare, ...progress] },
  { key: 'r_compare', label: 'Compare: results', msgs: [qCompare, { type: 'reveal', kind: 'compare', right: [4, 3, 1, 4, 2], players: 4, explanation: 'Psycho is the oldest of them all.', scores, you: { ...you, right: 3, of: 5 } }] },
]);

// Power-ups: the cards, the TV while players pick, the round's summary, each attack on this phone, and the bonuses
/** @type {import('./types').PowerRow[]} */
const powerRows = [
  { player: PLAYERS[0], got: [{ power: 'bet', from: PLAYERS[2] }, { power: 'spin', from: PLAYERS[3] }] },
  { player: PLAYERS[1], got: [{ power: 'freeze', from: PLAYERS[0] }, { power: 'gloop', from: PLAYERS[0] }, { power: 'bombs', from: PLAYERS[3] }, { power: 'double', from: null }] },
  { player: PLAYERS[2], got: [{ power: 'dziobaki', from: PLAYERS[1] }] },
  { player: PLAYERS[3], got: [] },
];
/** A question with `n` stacks of each of `powers` on this phone @param {QuestionMsg} q @param {import('./types').Power[]} powers @param {number} [n] */
const fxQ = (q, powers, n = 1) => ({ ...q, powers: [{ player: ME, got: powers.flatMap(power => Array(n).fill({ power, from: PLAYERS[0] })) }] });
const POWER_SCREENS = /** @type {{ key: string, label: string, only?: 'host' | 'player', msgs: ServerMsg[] }[]} */ ([
  { key: 'powers', label: 'Pick a card: Bet or a combo', only: 'player', msgs: [{ type: 'powers', ...rnd, cards: [['bet'], ['freeze', 'gloop']], targets: PLAYERS.filter(p => p !== ME), seconds: 20 }] },
  { key: 'powers2', label: 'Pick a card: Bombs or Double, 6 targets', only: 'player', msgs: [{ type: 'powers', ...rnd, cards: [['bombs'], ['double']], targets: [...PLAYERS.filter(p => p !== ME), ...PLAYERS.filter(p => p !== ME)], seconds: 20 }] },
  { key: 'dealing', label: 'Players picking power-ups', only: 'host', msgs: [{ type: 'dealing', ...rnd, seconds: 20, powers: ['freeze', 'gloop', 'dziobaki', 'spin', 'bombs', 'double', 'bet'], players: PLAYERS.map((p, i) => ({ ...p, done: i < 2 })), writing: true }] },
  { key: 'ready_fx', label: 'Round intro with power-ups played', msgs: [{ type: 'ready', ...rnd, category: cats[0], total: 5, powers: powerRows }] },
  { key: 'fx_freeze', label: 'Attack: Freeze', only: 'player', msgs: [fxQ(question, ['freeze'])] },
  { key: 'fx_gloop', label: 'Attack: Gloop', only: 'player', msgs: [fxQ(question, ['gloop'])] },
  { key: 'fx_gloop3', label: 'Attack: Gloop ×3', only: 'player', msgs: [fxQ(question, ['gloop'], 3)] },
  { key: 'fx_letters', label: 'Attack: Dziobaki', only: 'player', msgs: [fxQ(question, ['dziobaki'])] },
  { key: 'fx_letters3', label: 'Attack: Dziobaki ×3', only: 'player', msgs: [fxQ(question, ['dziobaki'], 3)] },
  { key: 'fx_spin', label: 'Attack: Spin', only: 'player', msgs: [fxQ(question, ['spin'])] },
  { key: 'fx_spin3', label: 'Attack: Spin ×3', only: 'player', msgs: [fxQ(question, ['spin'], 3)] },
  { key: 'fx_bombs', label: 'Attack: Bombs', only: 'player', msgs: [fxQ(question, ['bombs'])] },
  { key: 'fx_bombs3', label: 'Attack: Bombs ×3', only: 'player', msgs: [fxQ(question, ['bombs'], 3)] },
  { key: 'fx_mix', label: 'Attack: all five at once', only: 'player', msgs: [fxQ(question, ['freeze', 'gloop', 'dziobaki', 'spin', 'bombs'])] },
  { key: 'fx_sort', label: 'Attack in Sort: Dziobaki, Bombs, Gloop', only: 'player', msgs: [fxQ(qSort, ['dziobaki', 'bombs', 'gloop'])] },
  { key: 'fx_order', label: 'Attack in Order: Spin, Gloop', only: 'player', msgs: [fxQ(qOrder, ['spin', 'gloop'])] },
  { key: 'r_bonus', label: 'Answer with Double and Bet points', only: 'player', msgs: [question, { ...reveal, you: { ...reveal.you, delta: 2460, double: 820, bets: [{ ...PLAYERS[0], points: 820 }] } }] },
  { key: 'boom', label: 'Bomb banner', only: 'host', msgs: [question, { type: 'boom', player: PLAYERS[1] }] },
]);

/** Each screen is the messages the server would have sent to get there, in groups for the dev bar's list (no group: the
 * game's main flow) @type {{ key: string, label: string, only?: 'host' | 'player', group?: string, msgs: ServerMsg[] }[]} */
const SCREENS = [
  { key: 'setup', label: 'Setup: game settings', only: 'host', msgs: [{ type: 'setup', settings, options, types: [...types], players: 4 }] },
  { key: 'lobby', label: 'Lobby: players joining', msgs: [{ type: 'lobby', players: PLAYERS, settings }] },
  { key: 'categories', label: 'Categories: suggest a topic', msgs: [categories, sent] },
  { key: 'category_ok', label: 'Categories: suggestion sent', only: 'player', msgs: [categories, { type: 'category_ok', text: cats[2] }] },
  { key: 'preparing', label: 'Categories: preparing the vote', only: 'host', msgs: [categories, sent, { type: 'preparing' }] },
  { key: 'vote', label: 'Vote: pick a category', msgs: [{ type: 'vote', ...rnd, options: cats, by, seconds: 15, total: 5, players: 4, best: 0 }, { type: 'votes', voted: 2, players: 4 }] },
  { key: 'pick', label: 'Vote: winning category', msgs: [{ type: 'pick', ...rnd, options: cats, by, counts: [1, 0, 3, 0], chosen: cats[2], total: 5 }] },
  { key: 'generating', label: 'Generating questions', only: 'player', msgs: [{ type: 'generating', ...rnd, categories: [cats[0]], total: 5 }] },
  { key: 'ready', label: 'Round intro', msgs: [{ type: 'ready', ...rnd, category: cats[0], total: 5 }] },
  { key: 'question', label: 'Classic: question', msgs: [question, { type: 'answered', players: PLAYERS.map((p, i) => ({ ...p, done: i < 2 })) }] },
  { key: 'reveal', label: 'Classic: answer, right', msgs: [question, reveal] },
  { key: 'reveal_wrong', label: 'Classic: answer, wrong', only: 'player', msgs: [question, { ...reveal, you: { answered: true, correct: false, delta: 0, score: 2830, rank: 3, streak: 0 } }] },
  { key: 'reveal_slow', label: 'Classic: answer, too slow', only: 'player', msgs: [question, { ...reveal, you: { answered: false, correct: false, delta: 0, score: 2830, rank: 3, streak: 0 } }] },
  { key: 'round_end', label: 'Round end: standings', msgs: [{ type: 'round_end', ...rnd, scores }] },
  { key: 'final', label: 'Game over: scores and awards', msgs: [{ type: 'scores', scores, final: true, questions: 15, awards: [
    { key: 'speed_demon', icon: '⚡', title: 'Speed demon', text: 'Ania answered in 1.2 s. Did she even read it?', player: PLAYERS[0] },
    { key: 'on_fire', icon: '🔥', title: 'On fire', text: 'Kamil got 5 in a row.', player: PLAYERS[1] },
    { key: 'brain_buster', icon: '🧠', title: 'Brain buster', text: 'Nobody knew who painted the Arnolfini Portrait.', player: null }] }] },
  ...KIND_SCREENS.map(s => ({ ...s, group: 'Round types' })),
  ...POWER_SCREENS.map(s => ({ ...s, group: 'Power-ups' })),
  { key: 'error', label: 'Error', msgs: [{ type: 'error', message: 'Claude did not return any usable questions.' }] },
];

const CSS = `#devbar{position:fixed;left:8px;bottom:8px;z-index:100;display:flex;gap:4px;padding:6px;max-width:calc(100vw - 16px);
  background:rgba(0,0,0,.8);border-radius:8px;font:13px/1 system-ui,sans-serif}
#devbar.min select{display:none}
#devbar button{background:#B42D31;color:#fff;border:0;border-radius:4px;padding:6px 8px;cursor:pointer;font:inherit}
#devbar select{min-width:0;max-width:340px;background:#333;color:#fff;border:0;border-radius:4px;padding:5px 6px;font:inherit;cursor:pointer}`;

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
  /** @type {Map<string, typeof list>} */
  const groups = new Map();
  for (const s of list) groups.set(s.group || 'Game flow', [...groups.get(s.group || 'Game flow') || [], s]);
  const opt = (/** @type {{ key: string, label: string }} */ s) => `<option value="${s.key}"${s.key === screen ? ' selected' : ''}>${s.label}</option>`;
  bar.innerHTML = `<style>${CSS}</style><button class="tog" title="Hide or show the dev bar">DEV</button><select title="Preview a screen">${opt({ key: '', label: 'Live game' })}`
    + [...groups].map(([g, ss]) => `<optgroup label="${g}">${ss.map(opt).join('')}</optgroup>`).join('') + '</select>';
  bar.querySelector('.tog')?.addEventListener('click', () => { sessionStorage.devMin = bar.classList.toggle('min') ? '1' : ''; });
  bar.querySelector('select')?.addEventListener('change', e => {
    sessionStorage.devScreen = /** @type {HTMLSelectElement} */ (e.target).value;
    location.reload();  // reload drops the websocket and any page state
  });
  document.body.appendChild(bar);
  const cur = list.find(s => s.key === screen);
  if (!cur) return false;
  cur.msgs.forEach(on);
  stopTimer();
  return true;
}
