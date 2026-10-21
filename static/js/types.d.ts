// Types for the websocket protocol in main.py (ws_endpoint, run_quiz, reveal).
// Used only for editor/tsc type checking of the JSDoc-annotated JS; never loaded by the browser.

/** `avatar` is an emoji, or '' to show the name's initial */
export interface Player { name: string; avatar: string; color: string }
/** `avatars` is empty when FEATURE_AVATARS is off; `players` are the ones connected right now */
export interface Info { url: string; qr: string; lang: 'en' | 'pl'; avatars: string[]; colors: string[]; players: Player[] }
export interface Score extends Player { score: number; streak: number; best: number; correct: number }
export interface You { answered: boolean; correct: boolean; delta: number; score: number; rank: number; streak: number }

// Server -> client
export type LobbyMsg = { type: 'lobby'; players: Player[] };
export type JoinedMsg = { type: 'joined' } & Player;
export type CategoriesMsg = { type: 'categories'; seconds: number; total: number; players: number };
export type CatsMsg = { type: 'cats'; list: string[]; submitted: number; players: number };
export type CategoryOkMsg = { type: 'category_ok'; text: string };
export type GeneratingMsg = { type: 'generating'; categories: string[]; total: number };
export type ProgressMsg = { type: 'progress'; done: number; total: number };
export type QuestionMsg = {
  type: 'question'; n: number; total: number; category: string; text: string; options: string[]; seconds: number;
};
/** Sent to the TV when a question starts and after each answer */
export type AnsweredMsg = { type: 'answered'; players: (Player & { done: boolean })[] };
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
  | { type: 'join'; pid: string; name: string; avatar?: string; color?: string }
  | { type: 'category'; text: string; surprise: boolean }
  | { type: 'answer'; i: number }
  | { type: 'start'; count: number }
  | { type: 'lobby' };
