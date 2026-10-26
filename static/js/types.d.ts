// Types for the websocket protocol in main.py (ws_endpoint, run_quiz, reveal).
// Used only for editor/tsc type checking of the JSDoc-annotated JS; never loaded by the browser.

/** `avatar` is an emoji, or '' to show the name's initial */
export interface Player { name: string; avatar: string; color: string }
/** Round types: see KINDS in main.py. Sort and compare are sprints: one set per round, played at each phone's own pace.
 * About ("who knows them best"): players answer questions about themselves, then the others guess.
 * Draw: Pictionary, the `subject` draws a word only their phone gets (SecretMsg), the others pick it from `options` */
export type Kind = 'classic' | 'odd' | 'truefalse' | 'number' | 'order' | 'sort' | 'compare' | 'about' | 'draw';
/** One pen stroke: colour index (see INK in common.js) and points with x, y in 0..1 on a 4:3 canvas */
export interface Stroke { c: number; p: [number, number][] }
/** Game settings, changed by the host on the TV's setup screen */
/** `suggest_seconds`: suggesting categories before round 1; `category_seconds`: voting on a category each round */
/** `read_seconds`: reading the question before the answers show on phones; `reveal_seconds`: reading the answer before Continue works */
/** `types`: each round's type (one per possible round, only the first `rounds` are used); random is drawn at the start */
export interface Settings { rounds: number; per_round: number; suggest_seconds: number; category_seconds: number; question_seconds: number; read_seconds: number; reveal_seconds: number; avatars: boolean; types: (Kind | 'random')[] }
/** Allowed values for each numeric setting */
export type SettingOptions = { [K in Exclude<keyof Settings, 'avatars' | 'types'>]: number[] };
/** `players` are the ones connected right now; avatar pickers are shown only when settings.avatars is on;
 * `dev` is true with --dev (shows the dev bar) */
export interface Info {
  url: string; qr: string; lang: 'en' | 'pl'; avatars: string[]; colors: string[]; players: Player[]; settings: Settings; dev: boolean;
}
/** Position in a multi-round game, and this round's type */
export interface RoundInfo { round: number; rounds: number; kind: Kind }
export interface Score extends Player { score: number; streak: number; best: number; correct: number }
/** End-of-game award; `player` is null for awards about the game, like a question nobody got right */
export interface Award { key: string; icon: string; title: string; text: string; player: Player | null }
/** `correct`: counts as correct for streaks (number: the closest guess; order: all in place; sprints: 75% right).
 * Per kind: `value` the player's guess (number), `placed` items in the right place (order), `right` of `of` picks (sprints) */
export interface You {
  answered: boolean; correct: boolean; delta: number; score: number; rank: number; streak: number;
  value?: number; placed?: number; right?: number; of?: number;
  /** About rounds: the question was about you; `right` of `of` players guessed your answer */
  spotlight?: boolean;
}

// Server -> client
export type LobbyMsg = { type: 'lobby'; players: Player[]; settings: Settings };
/** TV only: setup screen before the lobby opens; `players` is how many phones are already connected */
export type SetupMsg = { type: 'setup'; settings: Settings; options: SettingOptions; types: (Kind | 'random')[]; players: number };
export type JoinedMsg = { type: 'joined' } & Player;
/** Everyone suggests a category, once per game before round 1 */
export type CategoriesMsg = { type: 'categories'; seconds: number; players: number };
/** TV only: suggestions are being tidied up by Claude before the first vote */
export type PreparingMsg = { type: 'preparing' };
/** Players vote on the round's category (suggestions not played yet, topped up with random topics); `by[i]` suggested `options[i]`
 * (empty for random topics); `total` is questions in this round */
export type VoteMsg = RoundInfo & { type: 'vote'; options: string[]; by: Player[][]; seconds: number; total: number; players: number };
/** TV only: sent after each vote */
export type VotesMsg = { type: 'votes'; voted: number; players: number };
/** Vote result: `counts[i]` votes for `options[i]`; `chosen` has the most, ties drawn at random */
export type PickMsg = RoundInfo & { type: 'pick'; options: string[]; by: Player[][]; counts: number[]; chosen: string; total: number };
export type CatsMsg = { type: 'cats'; list: string[]; submitted: number; players: number };
export type CategoryOkMsg = { type: 'category_ok'; text: string };
export type GeneratingMsg = RoundInfo & { type: 'generating'; categories: string[]; total: number };
export type ProgressMsg = { type: 'progress'; done: number; total: number };
/** Questions are ready; the round starts when a player holds Continue */
export type ReadyMsg = RoundInfo & { type: 'ready'; category: string; total: number };
export interface SortItem { text: string; bucket: number }
/** `value` is compared, `label` is shown (e.g. 19970101 and "1 Jan 1997") */
export interface CompareItem { text: string; value: number; label: string }
/** `n` and `total` count questions within the round. `options`: the choices, or the items to put in order (empty
 * otherwise); `unit`: shown after the number (number). Sprints: `key[i]` is the right pick i; sort: `items` go into
 * `buckets`; compare: pair i is the winner so far against `items[i + 1]`, pick 0 = winner, 1 = new item, and `higher`
 * says the higher value wins */
export type QuestionMsg = RoundInfo & {
  type: 'question'; n: number; total: number; category: string; text: string; options: string[]; unit: string; seconds: number;
  /** Seconds the answers stay hidden before the clock starts */
  lock: number;
  buckets?: string[]; items?: (SortItem | CompareItem)[]; higher?: boolean; key?: number[];
  /** About rounds: who the question is about (they don't answer it) */
  subject?: Player;
};
/** About rounds, before the questions: each player answers the `asks` whose subject they are, all at the same time */
export type AboutMsg = RoundInfo & { type: 'about'; seconds: number; asks: { subject: Player; q: string; options: string[] }[] };
/** Sent to the TV when a question starts and after each answer; `n` is picks so far, in sprints */
export type AnsweredMsg = { type: 'answered'; players: (Player & { done: boolean; n?: number })[] };
/** One player's guess in a number round */
export interface Guess extends Player { value: number; delta: number }
/** `you` is only present in the copy sent to each player. The game waits for a player to hold Continue.
 * Per kind: choice kinds `correct` (index) and `counts` per option; number `answer`, `unit` and `guesses` (closest
 * first); order `order` (option indices in the right order), `values` in that order and `placed[i]` players who put
 * option i in its place; sprints `right[i]` players who got pick i right, out of `players` */
export type RevealMsg = {
  type: 'reveal'; kind: Kind; explanation: string; scores: Score[]; you?: You;
  /** Seconds before Continue works, so everyone can read the answer */
  wait: number;
  correct?: number; counts?: number[];
  answer?: number; unit?: string; guesses?: Guess[];
  order?: number[]; values?: string[]; placed?: number[];
  right?: number[]; players?: number;
  /** Draw rounds: the finished drawing */
  strokes?: Stroke[];
};
/** Draw rounds, to the drawer only: the word to draw */
export type SecretMsg = { type: 'secret'; word: string };
/** Draw rounds, to the TV: points added to stroke `s` (a new stroke when s is the next index) */
export type InkMsg = { type: 'ink'; s: number; c: number; p: [number, number][] };
/** Draw rounds: the whole drawing, after an undo or clear and to a screen that reconnects */
export type StrokesMsg = { type: 'strokes'; strokes: Stroke[] };
/** Standings between rounds; the next round starts when a player holds Continue */
export type RoundEndMsg = RoundInfo & { type: 'round_end'; scores: Score[] };
/** `questions` is how many were asked in the whole game */
export type ScoresMsg = { type: 'scores'; scores: Score[]; final: boolean; questions: number; awards?: Award[] };
export type ErrorMsg = { type: 'error'; message: string };
export type ServerMsg =
  | LobbyMsg | SetupMsg | JoinedMsg | CategoriesMsg | CatsMsg | CategoryOkMsg | PreparingMsg | VoteMsg | VotesMsg | PickMsg | GeneratingMsg | ProgressMsg
  | ReadyMsg | AboutMsg | QuestionMsg | SecretMsg | InkMsg | StrokesMsg | AnsweredMsg | RevealMsg | RoundEndMsg | ScoresMsg | ErrorMsg;

// Client -> server
export type ClientMsg =
  | { type: 'join'; pid: string; name: string; avatar?: string; color?: string }
  | { type: 'category'; text: string; surprise: boolean }
  | { type: 'vote'; i: number }  // index in VoteMsg.options; can change until time runs out
  // t = seconds from the answers appearing to the tap, timed on the phone. One of: i (choice kinds), value (number),
  // order (option indices, first to last)
  | { type: 'answer'; i?: number; value?: number; order?: number[]; t: number }
  | { type: 'pick'; i: number; b: number; t: number }  // sprints: pick i (see QuestionMsg.key), b = 0 or 1
  | { type: 'mine'; i: number; b: number }  // about rounds: your answer b (option index) to AboutMsg.asks[i]
  // draw rounds, from the drawer: points for stroke s (the last one, or the next index to start one), colour c
  | { type: 'ink'; s: number; c: number; p: [number, number][] }
  | { type: 'undo' } | { type: 'clear' }
  | { type: 'continue' }  // after holding the Continue button
  // TV only:
  | { type: 'settings'; settings: Partial<Settings> }  // while on the setup screen
  | { type: 'open' }    // setup -> lobby (shows the QR code)
  | { type: 'setup' }   // back to the setup screen (e.g. Play again)
  | { type: 'start' };  // lobby -> first round
