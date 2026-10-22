# Quizzer

Party quiz: the host screen (TV) shows questions, players join and answer from their phones.

## Run locally

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then put your ANTHROPIC_API_KEY in .env
python main.py
```

- Host screen (TV): http://localhost:8000/host. It opens on a setup screen (rounds, questions per round,
  timers, avatars); **Open lobby** then shows the QR code.
- Players: scan the QR code on the host screen (phones must be on the same network)

End-of-game awards use the sentence templates in `awards.json`. On the setup screen the host can
let Claude write them instead (one extra API request per game).

## Dev mode

```bash
python main.py --dev
```

Uses questions from `mock_questions.json` instead of calling the Claude API (no API key needed)
and auto-reloads the server when you edit code. Tip: set `QUESTION_SECONDS=10`,
`SUGGEST_SECONDS=30` and `CATEGORY_SECONDS=5` in `.env` for faster test rounds. To test with several players on one
machine, open http://localhost:8000/ in different browsers or browser profiles
(each one keeps its own player id).

## Docker (local network)

```bash
cp .env.example .env   # set ANTHROPIC_API_KEY and PUBLIC_URL
docker compose up -d --build
```

`PUBLIC_URL` must be the server's LAN address, e.g. `http://192.168.1.50:8000/` (find it with
`hostname -I`), otherwise the QR code points at the container's internal IP. The server restarts
automatically; game state is in memory, so a restart ends the current game.
Logs: `docker compose logs -f`. Update after code changes: `docker compose up -d --build`.

## Frontend

Plain HTML/CSS/JS, no build step. Edit and reload.

```
static/
  host.html, player.html        # TV screen (/host) and phone controller (/)
  css/theme.css                 # shared colours, font, buttons, answer tiles
  css/host.css, css/player.css
  js/common.js                  # UI strings (pl/en), timer, websocket, fullscreen helpers
  js/host.js, js/player.js      # ES modules, one per page
  js/types.d.ts                 # websocket message types (for type checking only)
```

The JS is type-checked from JSDoc comments (`// @ts-check`). VS Code shows errors as you type.
To check from the command line (needs Node.js; nothing is installed into the project):

```bash
npx -p typescript tsc -p jsconfig.json
```
