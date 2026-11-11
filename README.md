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

Questions for the "Who knows them best" round type are in `about_questions.json`.
End-of-game awards use the sentence templates in `awards.json`.

## Dev mode

```bash
python main.py --dev
```

Uses questions from `mock_questions.json` instead of calling the Claude API (no API key needed)
and auto-reloads the server when you edit code. Tip: set `QUESTION_SECONDS=10`,
`SUGGEST_SECONDS=30` and `CATEGORY_SECONDS=5` in `.env` for faster test rounds. To test with several players on one
machine, open http://localhost:8000/ in different browsers or browser profiles
(each one keeps its own player id).

Dev mode also shows a dev bar at the bottom of the TV and phone pages. Pick a screen from its list (grouped
into the game's main flow, round types and power-ups) to preview it with sample data: the page goes offline
(no game needed, nothing is sent to the server) and the timer is frozen. The choice is kept per tab, so
refreshing after editing CSS/JS keeps you on that screen. **Live game** goes back to the real game; **DEV**
hides the list.

## Play over the internet (tunnel)

```bash
python main.py --tunnel        # also works with --dev
```

Starts a [Cloudflare quick tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/)
to the server running on your computer and prints a public address like `https://random-words.trycloudflare.com`.
The QR code uses it, so phones can join from any network (mobile data too), over https. Open `/host` at that
address (or still at localhost) on the TV. No account, domain or router setup is needed; the address changes on
every start and the tunnel closes when the server stops.

Needs `cloudflared` installed: on Debian/Ubuntu, the `.deb` from
[cloudflared releases](https://github.com/cloudflare/cloudflared/releases/latest); on macOS, `brew install cloudflared`.

Anyone who has the address can open `/host` and start games on your API key, so share it only with players.

**Fixed address on your own domain:** the domain must use Cloudflare DNS. Once:
`cloudflared tunnel login`, `cloudflared tunnel create quizzer`,
`cloudflared tunnel route dns quizzer quiz.example.com`. Then each time, run `python main.py` with
`PUBLIC_URL=https://quiz.example.com/` in `.env`, and in another terminal
`cloudflared tunnel run --url http://localhost:8000 quizzer`.

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
