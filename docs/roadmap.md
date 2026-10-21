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

Visual direction: dark navy/indigo stage gradient with a soft spotlight, one chunky rounded display font (Fredoka, to be bundled in `static/` so it works offline), the four high-contrast answer colours kept with their shapes for colour-blind players, cards with a slight 3D bottom shadow, and short pop/slide animations. Iterate on the mockups before touching code.

## Phase 1: Core redesign (required)
Files: `static/host.html`, `static/player.html`, new `static/theme.css` (shared tokens, fonts, answer colours/shapes), new `static/i18n.js`, `main.py` (small).
1. **Shared theme:** move the duplicated `:root` vars, `COL`, `SYM` and `esc` into `static/theme.css` and `static/i18n.js` (already served via `app.mount("/static", ...)` in `main.py`).
2. **UI language follows `QUIZ_LANGUAGE`:** `/api/info` (`main.py:info`) also returns `lang` (`"pl"` if `LANGUAGE` is Polish, otherwise `"en"`). `i18n.js` holds a `{pl:{...}, en:{...}}` string table plus a `t(key, vars)` helper. Both pages fetch `/api/info` before rendering (the player page currently doesn't, so add that).
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

**A. Avatars + colours (`FEATURE_AVATARS`)**
- The join form adds an emoji avatar grid and a colour choice, and the `join` message carries `avatar` and `color`.
- `main.py` stores both in `g.players` and includes them in `lobby_msg()` and `board()`.
- The TV shows avatars in the lobby, scoreboard and "who has answered" row. The `answered` message gets a pid list instead of only a count.
- Without avatars: initials on a hashed colour.

**B. Animated scoreboard + podium (TV only)**
- Animate scoreboard reordering with FLIP between reveals (keep the previous order in JS).
- Show a streak flame for 3+ correct answers in a row (server tracks `streak` per player in `reveal()`).
- The final screen becomes a 3-place podium with a CSS confetti burst.
- No protocol change other than `streak` in the scores.

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

## Verification
- **Phase 0:** review the mockups and agree on the look before coding.
- **Each phase:** run `python main.py --dev` with `QUESTION_SECONDS=10` and `CATEGORY_SECONDS=10` in `.env`, open `/host` in a desktop browser and `/` in 2–3 browser profiles.
- **Phone layout:**
  - Use Chrome DevTools device mode (iPhone SE, Pixel 7) in both orientations and check that all 4 answers are visible without scrolling, including with a 40-character answer. Add one long-answer question to `mock_questions.json` for this.
  - Test on a real phone over LAN (or Docker with `PUBLIC_URL`) for the fullscreen prompt, wake lock and the iOS Add to Home Screen hint.
- **Regression:** re-run the scratchpad websocket e2e script (join, start 5, answer, final scores) after the protocol changes in A/B/D.
- **Feature flags:** with all flags off, play a full game and confirm it behaves like Phase 1.
