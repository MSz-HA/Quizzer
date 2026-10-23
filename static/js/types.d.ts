// Types for the websocket protocol in main.py (ws_endpoint, run_quiz, reveal).
// Used only for editor/tsc type checking of the JSDoc-annotated JS; never loaded by the browser.

/** `avatar` is an emoji, or '' to show the name's initial */
export interface Player { name: string; avatar: string; color: string }
/** Game settings, changed by the host on the TV's setup screen */
/** `ai_awards`: Claude writes the end-of-game awards instead of the templates in awards.json */
/** `suggest_seconds`: suggesting categories before round 1; `category_seconds`: voting on a category each round */
export interface Settings { rounds: number; per_round: number; suggest_seconds: number; category_seconds: number; question_seconds: number; avatars: boolean; ai_awards: boolean }
/** Allowed values for each numeric setting */
export type SettingOptions = { [K in Exclude<keyof Settings, 'avatars' | 'ai_awards'>]: number[] };
/** `players` are the ones connected right now; avatar pickers are shown only when settings.avatars is on;
 * `dev` is true with --dev (shows the dev bar) */
export interface Info {
  url: string; qr: string; lang: 'en' | 'pl'; avatars: string[]; colors: string[]; players: Player[]; settings: Settings; dev: boolean;
}
/** Position in a multi-round game */
export interface RoundInfo { round: number; rounds: number }
export interface Score extends Player { score: number; streak: number; best: number; correct: number }
/** End-of-game award; `player` is null for awards about the game, like a question nobody got right */
export interface Award { key: string; icon: string; title: string; text: string; player: Player | null }
export interface You { answered: boolean; correct: boolean; delta: number; score: number; rank: number; streak: number }

// Server -> client
export type LobbyMsg = { type: 'lobby'; players: Player[]; settings: Settings };
/** TV only: setup screen before the lobby opens; `players` is how many phones are already connected */
export type SetupMsg = { type: 'setup'; settings: Settings; options: SettingOptions; players: number };
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
/** `n` and `total` count questions within the round */
export type QuestionMsg = RoundInfo & {
  type: 'question'; n: number; total: number; category: string; text: string; options: string[]; seconds: number;
};
/** Sent to the TV when a question starts and after each answer */
export type AnsweredMsg = { type: 'answered'; players: (Player & { done: boolean })[] };
/** `you` is only present in the copy sent to each player. The game waits for a player to hold Continue */
export type RevealMsg = {
  type: 'reveal'; correct: number; explanation: string; counts: number[]; scores: Score[]; you?: You;
};
/** Standings between rounds; the next round starts when a player holds Continue */
export type RoundEndMsg = RoundInfo & { type: 'round_end'; scores: Score[] };
/** `questions` is how many were asked in the whole game */
export type ScoresMsg = { type: 'scores'; scores: Score[]; final: boolean; questions: number; awards?: Award[] };
export type ErrorMsg = { type: 'error'; message: string };
export type ServerMsg =
  | LobbyMsg | SetupMsg | JoinedMsg | CategoriesMsg | CatsMsg | CategoryOkMsg | PreparingMsg | VoteMsg | VotesMsg | PickMsg | GeneratingMsg | ProgressMsg
  | ReadyMsg | QuestionMsg | AnsweredMsg | RevealMsg | RoundEndMsg | ScoresMsg | ErrorMsg;

// Client -> server
export type ClientMsg =
  | { type: 'join'; pid: string; name: string; avatar?: string; color?: string }
  | { type: 'category'; text: string; surprise: boolean }
  | { type: 'vote'; i: number }  // index in VoteMsg.options; can change until time runs out
  | { type: 'answer'; i: number }
  | { type: 'continue' }  // after holding the Continue button
  // TV only:
  | { type: 'settings'; settings: Partial<Settings> }  // while on the setup screen
  | { type: 'open' }    // setup -> lobby (shows the QR code)
  | { type: 'setup' }   // back to the setup screen (e.g. Play again)
  | { type: 'start' };  // lobby -> first round
