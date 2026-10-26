# Ideas

A place to collect ideas for improving the game. Nothing here is committed to. Ideas that get picked up move to [roadmap.md](roadmap.md).

### Gameplay
- **Final round with a twist:** e.g. last 3 questions worth double, or a race-to-the-finish line where correct answers move you forward.
- **Difficulty ramp:** ask Claude for easy questions first and harder ones later, instead of a random mix.
- **More end-of-game awards** once power-ups exist: most attacks sent, most attacks received, most times frozen, revenge attacks.
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
