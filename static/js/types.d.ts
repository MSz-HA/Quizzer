// Types for the websocket protocol in main.py (ws_endpoint, run_quiz, reveal).
// Used only for editor/tsc type checking of the JSDoc-annotated JS; never loaded by the browser.

/** `avatar` is an emoji, or '' to show the name's initial */
export interface Player { name: string; avatar: string; color: string }
/** Game settings, changed by the host on the TV's setup screen */
export interface Settings { rounds: number; per_round: number; category_seconds: number; question_seconds: number; avatars: boolean }
/** Allowed values for each numeric setting */
export type SettingOptions = { [K in Exclude<keyof Settings, 'avatars'>]: number[] };
/** `players` are the ones connected right now; avatar pickers are shown only when settings.avatars is on */
export interface Info {
  url: string; qr: string; lang: 'en' | 'pl'; avatars: string[]; colors: string[]; players: Player[]; settings: Settings;
}
/** Position in a multi-round game */
export interface RoundInfo { round: number; rounds: number }
export interface Score extends Player { score: number; streak: number; best: number; correct: number }
export interface You { answered: boolean; correct: boolean; delta: number; score: number; rank: number; streak: number }

// Server -> client
export type LobbyMsg = { type: 'lobby'; players: Player[]; settings: Settings };
/** TV only: setup screen before the lobby opens; `players` is how many phones are already connected */
export type SetupMsg = { type: 'setup'; settings: Settings; options: SettingOptions; players: number };
export type JoinedMsg = { type: 'joined' } & Player;
/** `total` is questions in this round; `used` are categories already played */
export type CategoriesMsg = RoundInfo & { type: 'categories'; seconds: number; total: number; players: number; used: string[] };
/** The round's category was drawn from `options`; the TV spins a carousel landing on `chosen` */
export type PickMsg = RoundInfo & { type: 'pick'; options: string[]; chosen: string; seconds: number; total: number };
export type CatsMsg = { type: 'cats'; list: string[]; submitted: number; players: number };
export type CategoryOkMsg = { type: 'category_ok'; text: string };
export type GeneratingMsg = RoundInfo & { type: 'generating'; categories: string[]; total: number };
export type ProgressMsg = { type: 'progress'; done: number; total: number };
/** `n` and `total` count questions within the round */
export type QuestionMsg = RoundInfo & {
  type: 'question'; n: number; total: number; category: string; text: string; options: string[]; seconds: number;
};
/** Sent to the TV when a question starts and after each answer */
export type AnsweredMsg = { type: 'answered'; players: (Player & { done: boolean })[] };
/** `you` is only present in the copy sent to each player */
export type RevealMsg = {
  type: 'reveal'; correct: number; explanation: string; counts: number[]; scores: Score[]; you?: You;
};
export type RoundEndMsg = RoundInfo & { type: 'round_end'; scores: Score[] };
/** `questions` is how many were asked in the whole game */
export type ScoresMsg = { type: 'scores'; scores: Score[]; final: boolean; questions: number };
export type ErrorMsg = { type: 'error'; message: string };
export type ServerMsg =
  | LobbyMsg | SetupMsg | JoinedMsg | CategoriesMsg | CatsMsg | CategoryOkMsg | PickMsg | GeneratingMsg | ProgressMsg
  | QuestionMsg | AnsweredMsg | RevealMsg | RoundEndMsg | ScoresMsg | ErrorMsg;

// Client -> server
export type ClientMsg =
  | { type: 'join'; pid: string; name: string; avatar?: string; color?: string }
  | { type: 'category'; text: string; surprise: boolean }
  | { type: 'answer'; i: number }
  // TV only:
  | { type: 'settings'; settings: Partial<Settings> }  // while on the setup screen
  | { type: 'open' }    // setup -> lobby (shows the QR code)
  | { type: 'setup' }   // back to the setup screen (e.g. Play again)
  | { type: 'start' };  // lobby -> first round
