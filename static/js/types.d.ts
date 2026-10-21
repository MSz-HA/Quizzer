// Types for the websocket protocol in main.py (ws_endpoint, run_quiz, reveal).
// Used only for editor/tsc type checking of the JSDoc-annotated JS; never loaded by the browser.

export interface Info { url: string; qr: string; lang: 'en' | 'pl' }
export interface Score { name: string; score: number }
export interface You { answered: boolean; correct: boolean; delta: number; score: number; rank: number }

// Server -> client
export type LobbyMsg = { type: 'lobby'; players: string[] };
export type JoinedMsg = { type: 'joined'; name: string };
export type CategoriesMsg = { type: 'categories'; seconds: number; total: number; players: number };
export type CatsMsg = { type: 'cats'; list: string[]; submitted: number; players: number };
export type CategoryOkMsg = { type: 'category_ok'; text: string };
export type GeneratingMsg = { type: 'generating'; categories: string[]; total: number };
export type ProgressMsg = { type: 'progress'; done: number; total: number };
export type QuestionMsg = {
  type: 'question'; n: number; total: number; category: string; text: string; options: string[]; seconds: number;
};
export type AnsweredMsg = { type: 'answered'; n: number; total: number };
/** `you` is only present in the copy sent to each player */
export type RevealMsg = {
  type: 'reveal'; correct: number; explanation: string; counts: number[]; scores: Score[]; you?: You;
};
export type ScoresMsg = { type: 'scores'; scores: Score[]; final: boolean };
export type ErrorMsg = { type: 'error'; message: string };
export type ServerMsg =
  | LobbyMsg | JoinedMsg | CategoriesMsg | CatsMsg | CategoryOkMsg | GeneratingMsg | ProgressMsg
  | QuestionMsg | AnsweredMsg | RevealMsg | ScoresMsg | ErrorMsg;

// Client -> server
export type ClientMsg =
  | { type: 'join'; pid: string; name: string }
  | { type: 'category'; text: string; surprise: boolean }
  | { type: 'answer'; i: number }
  | { type: 'start'; count: number }
  | { type: 'lobby' };
