# Live Leaderboard

A real-time leaderboard built with **Redis sorted sets**, **Express**, **WebSockets** and **React**. Players submit scores, and every connected browser sees the ranking update live. There is no traditional database: Redis is the only data store.

It was built as a hands-on project for learning Redis, and includes a load-testing script that simulates hundreds of players and thousands of live viewers.

## Features

- Live ranking pushed to all browsers over WebSocket (no refresh needed)
- Podium for the top 3, animated rows, and floating `+points` indicators
- "Your rank" card that works even when you are outside the top list
- Live stats: total players, viewers watching right now, top score
- Auto-play mode for demos
- Broadcast throttling, so hundreds of score updates per second become at most 2 pushes per second
- Rate limiting, input validation and an admin key for reset routes
- Load-test simulator with live req/s, failures and latency percentiles
- Redis persistence (AOF) through Docker Compose

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite), plain CSS |
| Backend | Node.js, Express 5, `ws` |
| Data store | Redis 7 (sorted sets), `ioredis` |
| Infrastructure | Docker Compose |

## How it works

```
Players (React) --POST /score--> Express --ZINCRBY--> Redis sorted set
                                    |                       |
Viewers (React) <--WebSocket-- Express <--ZREVRANGE---------+
```

1. A player sends a score to `POST /score`.
2. Express updates the player's total in Redis with `ZINCRBY`, which is atomic.
3. A throttled broadcast (every 500 ms at most) reads the top N with `ZREVRANGE ... WITHSCORES` and pushes it to all connected WebSocket clients.
4. React receives the message and re-renders the board.

### Redis commands used

| Command | Purpose |
|---|---|
| `ZADD key NX score member` | Add a new player with the initial score if missing |
| `ZINCRBY` | Add points to a player |
| `ZREVRANGE ... WITHSCORES` | Top N players, highest first (also used for pagination) |
| `ZREVRANK` | A player's rank |
| `ZSCORE` | A player's score |
| `ZCARD` | Total number of players |
| `ZUNIONSTORE ... WEIGHTS 0` | Set every score to 0 while keeping the players |
| `DEL` | Wipe the leaderboard |
| `MULTI / EXEC` | Run the add and increment as one transaction |

## Project structure

```
LiveLeaderboard/
├── docker-compose.yml      # Redis (with password and persistence)
├── .env                    # secrets (not committed)
├── .env.example            # template for .env
├── README.md
├── server/
│   ├── package.json
│   ├── redis.js            # Redis connection
│   ├── leaderboard.js      # all Redis logic (sorted-set functions)
│   ├── server.js           # Express routes + WebSocket + broadcasting
│   └── simulate.js         # load-test simulator
└── client/
    └── src/
        ├── config.js       # API and WebSocket URLs
        ├── hooks.js        # useLeaderboard, useStats, useMyRank, useScoreDelta
        ├── Avatar.jsx
        ├── Podium.jsx
        ├── Leaderboard.jsx
        ├── ScoreForm.jsx
        ├── App.jsx
        └── App.css
```

## Prerequisites

- **Node.js 20.6 or newer** (needed for the built-in `--env-file` flag). Check with `node -v`.
- **Docker Desktop** (for Redis)

## Getting started

### 1. Configure environment variables

Create a `.env` file in the project root (next to `docker-compose.yml`):

```env
PORT=3000
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=change-me-to-something-long
ADMIN_KEY=change-me-too
```

Make sure the file is named exactly `.env` (on Windows, check it was not saved as `.env.txt`).

### 2. Start Redis

```bash
docker compose up -d
docker compose ps        # wait until the redis service says "healthy"
```

### 3. Start the backend

```bash
cd server
npm install
npm run dev
```

The server runs on `http://localhost:3000`. The `dev` script in `server/package.json` loads the shared root `.env`:

```json
"scripts": {
  "dev": "node --watch --env-file=../.env server.js",
  "simulate": "node --env-file=../.env simulate.js 100 50 30"
}
```

### 4. Start the frontend

In a second terminal:

```bash
cd client
npm install
npm run dev
```

Open **http://localhost:5173**.

### 5. Try it

1. Enter a name and click **Play a round**, or turn on **Auto-play**.
2. Open the app in a second tab with another name. Scores in one tab show up in the other within about half a second.
3. Run the simulator (below) to watch the board churn with many players.

## Environment variables

| Variable | Where | Description | Default |
|---|---|---|---|
| `PORT` | root `.env` | Server port | `3000` |
| `REDIS_URL` | root `.env` | Redis connection URL | `redis://localhost:6379` |
| `REDIS_PASSWORD` | root `.env` | Used by Compose to protect Redis, and by the server to connect | none |
| `ADMIN_KEY` | root `.env` | Secret for the reset routes | none |
| `DISABLE_LIMITS` | shell, optional | Set to `true` to turn off rate limiting for load tests | off |
| `VITE_API_URL` | `client/.env`, optional | Backend HTTP URL | `http://localhost:3000` |
| `VITE_WS_URL` | `client/.env`, optional | Backend WebSocket URL | `ws://localhost:3000` |

Never put secrets in `client/.env`. Everything in the browser bundle is public.

## API reference

| Method | Route | Description |
|---|---|---|
| `POST` | `/score` | Add points. Body: `{ "name": "yash", "points": 42 }`. Name 1 to 20 characters, points an integer from 1 to 100 |
| `GET` | `/leaderboard?page=1&size=50` | Paginated list. Returns `{ page, size, total, entries }` (max size 100) |
| `GET` | `/players/:name` | One player's `{ name, rank, score }`, or 404 |
| `GET` | `/stats` | `{ connectedViewers, totalPlayers }` |
| `DELETE` | `/reset` | Delete all players. Requires header `x-admin-key` |
| `POST` | `/reset-scores` | Keep all players, set every score to 0. Requires header `x-admin-key` |

Examples (PowerShell):

```powershell
Invoke-RestMethod -Method Post http://localhost:3000/score -ContentType 'application/json' -Body '{"name":"yash","points":50}'
Invoke-RestMethod "http://localhost:3000/leaderboard?page=1&size=10"
Invoke-RestMethod -Method Delete http://localhost:3000/reset -Headers @{ 'x-admin-key' = 'your-admin-key' }
```

### WebSocket

Connect to `ws://localhost:3000`. The server sends the current board immediately, and again whenever scores change (throttled to every 500 ms):

```json
{
  "type": "leaderboard",
  "data": [{ "rank": 1, "name": "yash", "score": 1250 }],
  "viewers": 12
}
```

## Load testing

The simulator runs many fake players and viewers and prints stats every second.

```bash
cd server
node simulate.js <players> <viewers> <seconds>

node simulate.js 100 50 30       # light
node simulate.js 1000 3000 30    # heavier
```

Rate limiting is per IP, and the simulator runs from a single IP, so turn the limits off while load testing:

```powershell
# PowerShell
$env:DISABLE_LIMITS='true'; npm run dev
```

```bash
# macOS / Linux
DISABLE_LIMITS=true npm run dev
```

Restart the server without the variable afterwards.

### Reading the output

```
t= 10s | req/s: 1667 | failed: 0 | updates received/s: 6000 | latency p50: 9ms, p95: 92ms
```

| Field | Meaning |
|---|---|
| `req/s` | Successful score requests per second |
| `failed` | Requests that errored, timed out or were rejected |
| `updates received/s` | WebSocket messages received by all viewers |
| `p50` | Median latency. Half of requests are faster |
| `p95` | 95% of requests are faster than this |

On a typical laptop, roughly 1,000 players and 3,000 viewers is comfortable. The simulator and server share the machine, so these numbers are for learning, not for production benchmarks. A single machine also cannot hold hundreds of thousands of connections (memory and OS port limits).

## Resetting the leaderboard

```bash
# Delete everyone
docker compose exec redis sh -c 'redis-cli -a "$REDIS_PASSWORD" DEL leaderboard'
```

Or call `DELETE /reset` with the admin key. New players start at the `INITIAL_SCORE` constant in `server/leaderboard.js`.

## Security notes

- Redis is bound to `127.0.0.1` and password protected.
- Scores are validated on the server (type, range, name pattern).
- Reset routes need the `x-admin-key` header.
- Rate limits: 300 requests per minute per IP overall, and 5 per second on `/score`.
- CORS is limited to the frontend origin, and `helmet` sets security headers.
- WebSocket messages are size limited, and dead connections are cleaned up with a heartbeat.

This is a learning project. Anyone can still submit scores under any name, because there are no user accounts. A production game would authenticate players and calculate points on the server.

## Troubleshooting

| Problem | Fix |
|---|---|
| `REDIS_PASSWORD is missing a value` when running Compose | The root `.env` is missing, misnamed (`.env.txt`) or in the wrong folder |
| `NOAUTH Authentication required` | The password in `.env` does not match the one Redis started with. Run `docker compose down` and `docker compose up -d` to recreate the container |
| Status badge stuck on `reconnecting` | The backend is not running, or `VITE_WS_URL` is wrong |
| Simulator shows lots of `failed` | Rate limiting. Start the server with `DISABLE_LIMITS=true` |
| `Reached heap limit` in the simulator | Too many connections for one Node process. Lower the player and viewer counts |
| `process.env.X` is `undefined` | The `.env` file was not loaded. Check the `--env-file` path in your npm script |

## Ideas for next steps

- User accounts, so scores cannot be submitted under someone else's name
- Redis Pub/Sub to broadcast across several server processes
- Daily or weekly boards using key expiry (`EXPIRE`)
- Debounce the "your rank" lookup in the frontend
- Automated tests for the leaderboard functions

## License

MIT
