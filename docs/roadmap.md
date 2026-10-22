# Quizzer roadmap: redesign + Knowledge-style features

## Context
The TV (`static/host.html`) and phone (`static/player.html`) screens work but look plain: a flat purple background, Trebuchet font, no motion, and phone answer buttons that ignore orientation. The goal is a party-game look close to *Knowledge is Power*: a bold TV show screen and phones that work as simple controllers. All four answers must be visible on the phone in portrait (1 column) and landscape (2x2), and phones should prompt the player to go fullscreen.
Extra features (avatars, power-ups, animated scoreboard/podium, sound/haptics) are **optional later phases**. The game must stay fully playable without any of them, so each one is self-contained and can be switched off.

## Phase 0: Design mockups (done, under review)
Mockups: [Quizzer redesign canvas](https://claude.ai/artifact/6qKMJiBu28Lu1iWx8B9DXe) (private, share from its Share menu). Artboards:
- **TV 1920×1080:** Lobby (QR, URL, player cards, question-count pills, Start), Categories (countdown ring, progress, submitted chips), Question (category tag, n/total, timer ring, 2x2 coloured answers with shapes, who-answered row), Reveal (wrong answers dimmed, vote bars, explanation, top-5 with +delta), Final scores (ranked list, top 3 highlighted). The "Generating" screen isn't drawn; it reuses the Categories layout with a progress bar.
- **Phone portrait 390×844:** Join (name + fullscreen prompt, Android/iOS variants), Category input, Question (4 stacked buttons filling the screen), Locked in, Result (correct / wrong / too slow).
- **Phone landscape 844×390:** Question (2x2 grid filling the screen).
- **Later (optional features):** avatar picker, power-up attack screen, frozen effect, TV podium with confetti.

Visual direction: dark navy/indigo stage gradient with a soft spotlight, one chunky rounded display font (Baloo 2, chosen over Fredoka for Polish/Latin-ext coverage, bundled in `static/` so it works offline), the four high-contrast answer colours kept with their shapes for colour-blind players, cards with a slight 3D bottom shadow, and short pop/slide animations. Iterate on the mockups before touching code.

## Phase 1: Core redesign (done)
Files: `static/host.html`, `static/player.html`, new `static/css/theme.css` (shared tokens, bundled Baloo 2 font, answer colours), new `static/js/common.js` (strings + `t()`, shapes, avatars, timer, websocket, fullscreen helpers). Later split into `static/css/*.css` and `static/js/*.js` ES modules with JSDoc type checking, see README, `static/manifest.json` + `static/icon.svg`, `main.py` (`lang` in `/api/info`).
1. **Shared theme:** move the duplicated `:root` vars, `COL`, `SYM` and `esc` into `static/theme.css` and `static/common.js` (already served via `app.mount("/static", ...)` in `main.py`).
2. **UI language follows `QUIZ_LANGUAGE`:** `/api/info` (`main.py:info`) also returns `lang` (`"pl"` if `LANGUAGE` is Polish, otherwise `"en"`). `common.js` holds a `{pl:{...}, en:{...}}` string table plus a `t(key, vars)` helper. Both pages fetch `/api/info` before rendering (the player page currently doesn't, so add that).
3. **Phone layout:**
   - `.opts` uses `height: 100dvh` minus the header. `@media (orientation: portrait)` gives 1 column × 4 rows; `@media (orientation: landscape)` gives a 2×2 grid. Font size uses `clamp()` so long answers wrap and stay visible.
   - Show the answer text plus its shape on the phone. The question text stays on the TV (Knowledge style), with a small "n of total" line.
   - Disable double-tap zoom and text selection on buttons (`touch-action: manipulation`, `user-select: none`).
4. **Fullscreen prompt:**
   - Show a dismissible "Tap for fullscreen" banner on the phone when `document.fullscreenEnabled` and not already fullscreen. It calls `document.documentElement.requestFullscreen()` inside the tap handler (browsers require a user gesture). The Join button also requests fullscreen.
   - iPhone Safari has no element fullscreen, so show an "Add to Home Screen" hint instead. Add `static/manifest.json` (`display: "fullscreen"`, icon, theme colour) plus the `apple-mobile-web-app-capable` meta. This needs a `/manifest.json` route or a link to `/static/manifest.json`.
   - Request a Screen Wake Lock (`navigator.wakeLock`) when available so phones don't dim mid-game. Silently skip it if unsupported.
5. **TV polish (CSS + small JS only):** layout per the artifact, a countdown bar/ring driven by CSS animation (replaces the text-only countdown in `countdown()`), reveal dims wrong answers and shows count bars from `m.counts`, scoreboard deltas.
6. **Connection indicator:** a small "Reconnecting…" pill on both pages when the websocket is closed (`ws.onclose` already retries).

The server protocol stays unchanged except for `lang` in `/api/info`.

## Phase 2+: Optional features (each independent, build later in any order)
Each feature has an on/off switch (`.env` flag with a lobby toggle where it makes sense). With every switch off, the game behaves exactly like Phase 1.

**A. Avatars + colours (`FEATURE_AVATARS`, default on) — done**
- The join form has a colour choice and an emoji avatar grid (or the name's initial). The `join` message carries `avatar` and `color`; the server validates both against `COLORS`/`AVATARS` in `main.py`.
- The server always assigns a colour, preferring a free one, so players get distinct colours even with the flag off.
- Players are objects (`name`, `avatar`, `color`) in `lobby`, `joined` and the scores. `answered` carries the active players with a `done` flag, so the TV lights up avatars as people answer.
- Identity reset: a saved identity only auto-rejoins if the player was active in the last 2 hours. Otherwise the join form opens pre-filled. Name and look can be changed from the lobby and game-over screens (not mid-game); duplicate names get a number.
- Flag off: name only, initial on the assigned colour.

**B. Animated scoreboard + podium (TV only) — done**
- On reveal, leaderboard rows start at their previous rank and slide into place, scores count up, then the +points appear.
- The server tracks `streak`, `best` and `correct` per player. A flame badge shows on 3+ correct in a row, and the phone shows "🔥 3 in a row".
- The final screen is a 3-place podium with confetti, the winner's stats, and places 4–8 in a short list.
- No flag: it is purely visual, and animations are skipped with `prefers-reduced-motion`.

**C. Sound, timer ring, haptics**
- TV: small sound files in `static/sfx/` (tick during the last 5s, reveal, fanfare) with a mute toggle remembered in localStorage. Browsers block sound until the first click, so the Start button unlocks audio.
- Phone: `navigator.vibrate` on lock-in, correct (short) and wrong (double). It's a no-op on iOS.

**D. Power-ups (`FEATURE_POWERUPS`, lobby toggle, biggest change)**
- Earn one power-up for 2 correct answers in a row, with at most 2 held.
- Types:
  - **Freeze:** target's buttons locked for 3s.
  - **Gloop:** target's answer texts blurred until they tap to wipe.
  - **Double:** your next correct answer scores ×2.
- Power-ups are used in a short "attack window" during the reveal, by picking a target on the phone. Effects apply to the next question.
- Server changes:
  - `use_power` message, validated in `ws_endpoint`.
  - `g.players[pid]` gains `powers`, `effects` and `streak`.
  - The `question` message sent per player includes their active effects, so `bc` needs a per-player variant like `reveal()` already does.
- TV shows "Ania froze Kamil!" banners.

**E. End-of-game awards (setup toggle for Claude) — done**
- `reveal()` adds one record per question to `g.log` (who answered, right or wrong, how fast, ranking afterwards). `award_facts()` in `main.py` turns the log into the awards that apply. `pick_awards()` takes up to 5 of them, spread over as many players as possible.
- Awards: speed demon, last-second hero, confidently wrong, quick draw, the thinker, on fire, cold streak, asleep at the wheel, brain buster (nobody got it), too easy (everybody got it), comeback, free fall, and, with 2+ rounds, category expert and blind spot.
- By default each award's sentence comes from `awards.json` (icon, title and 20–30 lines per award, in English and Polish). With *End-of-game awards: Written by Claude* on the setup screen, Claude writes the titles and lines in one request. It starts during the last reveal, while players hold Continue. Templates are the fallback in dev mode or when the call fails.
- The TV shows the podium, then one award card at a time, then the podium again. Phones show the player's own awards under their final rank.

## Phase 3: Game setup and rounds (done)
- The TV opens on a **setup screen**: rounds (1–5), questions per round, time to suggest categories, time to vote on a category, answer time, avatars on/off. Settings live in memory (`g.settings` in `main.py`); `.env` gives the starting values. **Open lobby** shows the QR code; **Play again** returns to setup with the same values. Phones can join while the host is still on setup.
- **Suggestions:** once per game, before round 1, everyone suggests a category. Claude (the main model, low effort) turns all suggestions into short category names and merges duplicates in a single call. New suggestions also go to an in-memory bank that can fill votes in later games.
- **Rounds:** before each round, players vote on 4 categories: unplayed suggestions picked at random, topped up with random built-in or banked topics. Phones show the choices in the answer colours and shapes; a vote can be changed until time runs out, and voting ends early once everyone has voted. The most votes wins; ties (including no votes at all) are drawn at random among the tied categories. Generation starts straight away while the TV shows the vote counts and the winner. Standings are shown between rounds.
- Protocol: `setup`, `vote`, `votes`, `pick` and `round_end` messages are new; `vote`, `pick`, `question` and `generating` carry `round`/`rounds`. Phones send `vote`. The TV sends `settings`, `open`, `setup` and `start` (see `static/js/types.d.ts`).

## Verification
- **Phase 0:** review the mockups and agree on the look before coding.
- **Each phase:** run `python main.py --dev` with `QUESTION_SECONDS=10`, `SUGGEST_SECONDS=30` and `CATEGORY_SECONDS=5` in `.env`, open `/host` in a desktop browser and `/` in 2–3 browser profiles.
- **Phone layout:**
  - Use Chrome DevTools device mode (iPhone SE, Pixel 7) in both orientations and check that all 4 answers are visible without scrolling, including with a 40-character answer. Add one long-answer question to `mock_questions.json` for this.
  - Test on a real phone over LAN (or Docker with `PUBLIC_URL`) for the fullscreen prompt, wake lock and the iOS Add to Home Screen hint.
- **Regression:** re-run the scratchpad websocket e2e script (join, start 5, answer, final scores) after the protocol changes in A/B/D.
- **Feature flags:** with all flags off, play a full game and confirm it behaves like Phase 1.
