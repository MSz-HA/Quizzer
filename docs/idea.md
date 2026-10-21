# Ideas

A place to collect ideas for improving the game. Nothing here is committed to. Ideas that get picked up move to [roadmap.md](roadmap.md).

### End-of-game stats and funny awards

Like the end-of-round summary in Worms Armageddon: after the final scores, show a few short, funny lines about how the game went.

**Stats to track** (per player and per game):
- Fastest correct answer, and slowest answer that was still correct ("last-second hero")
- Average answer time; the fastest and slowest player on average
- Longest correct streak; longest wrong streak
- Questions nobody got right / everybody got right
- Fastest wrong answer ("confidently wrong")
- Most "too slow" timeouts
- Biggest climb or fall in the ranking during the game
- Best and worst category per player (questions carry `cat`)
- After power-ups exist: most attacks sent, most attacks received, most times frozen, revenge attacks

**Where the data comes from:**
- `reveal()` in `main.py` already has each answer's index and time in `g.answers` (`pid -> (idx, seconds)`). Appending a record per question (pid, correct, time, rank before/after) to a game log is enough for almost everything above.
- Keep the log in memory per game. Save it to disk later if we want history across games (see below).

**Turning stats into sentences, two options:**
1. **Templates (simple, offline, works in `--dev`):** a list of sentence templates per award, e.g. "{name} answered in {t}s. Did they even read the question?" Pick 3–5 awards at random among the ones that apply. Translations go with the i18n table.
2. **Claude (funnier, varied):** send the stats summary (not the raw log) in one request at the end of the game, asking for 3–5 short, friendly roasts in `QUIZ_LANGUAGE`. Start generating at the last question so it's ready when the final screen shows. Fall back to templates when there's no API key or the call fails.

**Display:** TV only, one award card at a time after the podium (title, player avatar, sentence), like an awards ceremony. Phones show "You won: Speed demon" if the player got one.


### Gameplay
- **Different round types** (Knowledge is Power has several):
  - "Closest number wins": answer is a number, typed on the phone, scored by distance.
  - Order the items (put 4 events in chronological order).
  - True/false speed round with shorter timers.
  - "Odd one out".
  Claude can generate all of these with a `type` field in the JSON.
- **Final round with a twist:** e.g. last 3 questions worth double, or a race-to-the-finish line where correct answers move you forward.
- **Difficulty ramp:** ask Claude for easy questions first and harder ones later, instead of a random mix.
- **"Who knows them best" round:** each player answers a question about themselves on their phone, then others guess. Good for parties, needs no API.
- **Comeback help** for the last-place player (e.g. a free power-up), so nobody drops out mentally.
- **Team mode:** 2–4 teams, score is the team average.

### Host and atmosphere
- **Quiz host voice:** short host lines between questions ("Ooh, only one of you got that!"). Generated from templates or Claude, optionally read aloud with the browser's `speechSynthesis` on the TV.
- **Read questions aloud** on the TV (also `speechSynthesis`). Helps when the TV is far away.
- **Per-question reactions** on reveal: "Nobody got it!", "Everyone picked ▲. Wrong!", "Kamil was the only one right".

### Questions
- **Question bank:** save every generated question set to disk (JSON or SQLite). This makes it possible to:
  - replay offline or without an API key
  - avoid repeating questions across games
  - mix old and new questions
- **Report a bad question** button on the phone during reveal. Store the reports and skip those questions in the bank.
- **Category voting:** players vote on suggested categories instead of every suggestion being used.

### Players and host controls
- **Persistent player profiles and history:** remember players by name/pid across games for all-time stats and "rematch" banter ("Ania has won 3 games in a row").
- **Host controls:** kick a player, pause, skip question, end game early.
- **Spectator mode:** join without playing (e.g. a second screen).
- **Late join:** let players join mid-game with 0 points.

### Practical
- **Rejoin after phone sleep:** already works via `pid` in localStorage; show "Welcome back" so players trust it.
- **Big-text / high-contrast mode** for the TV in bright rooms.
