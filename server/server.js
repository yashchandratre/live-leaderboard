import http from "node:http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { WebSocketServer, WebSocket } from "ws";
import {
  addScore,
  getTop,
  getPlayer,
  getPlayerCount,
  resetLeaderboard,
} from "./leaderboard.js";

const PORT = Number(process.env.PORT) || 3000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const BROADCAST_INTERVAL_MS = Number(process.env.BROADCAST_INTERVAL_MS) || 500;
const ENABLE_RATE_LIMIT = process.env.ENABLE_RATE_LIMIT === "true";

const app = express();

app.use(helmet());
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

// Enable rate limiting when configured or in production
if (ENABLE_RATE_LIMIT) {
  app.use(rateLimit({
    windowMs: 60_000,
    limit: 1000,
    standardHeaders: true,
    legacyHeaders: false,
  }));

  app.use("/score", rateLimit({
    windowMs: 1_000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many score submissions, slow down." },
  }));
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server, maxPayload: 1024 });

// Fast binary/pre-buffered payload or string cache
let cachedBoardJson = null;

const getBoardJson = async () => {
  const top100 = await getTop(100);
  return JSON.stringify({ type: "leaderboard", data: top100 });
};

const broadcastLeaderboard = async () => {
  if (wss.clients.size === 0) return;
  const message = await getBoardJson();
  cachedBoardJson = message;

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      if (client.bufferedAmount > 1_000_000) {
        client.terminate();
      } else {
        client.send(message);
      }
    }
  }
};

// Throttle: at most one broadcast per interval
let broadcastTimer = null;
let broadcastPending = false;

const scheduleBroadcast = () => {
  if (broadcastTimer) {
    broadcastPending = true;
    return;
  }

  broadcastTimer = setTimeout(async () => {
    broadcastTimer = null;
    try {
      await broadcastLeaderboard();
      if (broadcastPending) {
        broadcastPending = false;
        scheduleBroadcast();
      }
    } catch (err) {
      console.error("broadcast failed:", err.message);
    }
  }, BROADCAST_INTERVAL_MS);
};

wss.on("connection", async (socket) => {
  try {
    const payload = cachedBoardJson ?? (await getBoardJson());
    socket.send(payload);
  } catch (err) {
    console.error("WebSocket connection send failed:", err.message);
    socket.close(1011);
  }
});

const requireAdmin = (req, res, next) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || req.get("x-admin-key") !== adminKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

// ---------- Routes ----------
app.post("/score", async (req, res) => {
  try {
    const { name, points } = req.body || {};

    const MAX_POINTS = 100;
    const NAME_PATTERN = /^[\w .-]{1,20}$/;

    if (
      typeof name !== "string" ||
      !NAME_PATTERN.test(name.trim()) ||
      typeof points !== "number" ||
      !Number.isInteger(points) ||
      points < 1 ||
      points > MAX_POINTS
    ) {
      return res.status(400).json({ error: "Invalid player name (1-20 chars) or points (integer 1-100)" });
    }

    const trimmedName = name.trim();
    const score = await addScore(trimmedName, points);
    scheduleBroadcast();
    return res.json({ name: trimmedName, score });
  } catch (err) {
    console.error("Error in /score:", err.message);
    return res.status(500).json({ error: "Failed to update score" });
  }
});

app.get("/leaderboard", async (req, res) => {
  try {
    const count = Math.min(Math.max(Number(req.query.count) || 10, 1), 100);
    const top = await getTop(count);
    return res.json(top);
  } catch (err) {
    console.error("Error in /leaderboard:", err.message);
    return res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

app.get("/players/:name", async (req, res) => {
  try {
    const player = await getPlayer(req.params.name);
    if (!player) return res.status(404).json({ error: "player not found" });
    return res.json(player);
  } catch (err) {
    console.error("Error in /players/:name:", err.message);
    return res.status(500).json({ error: "Failed to fetch player" });
  }
});

app.get("/stats", async (req, res) => {
  try {
    const totalPlayers = await getPlayerCount();
    return res.json({
      connectedViewers: wss.clients.size,
      totalPlayers,
    });
  } catch (err) {
    console.error("Error in /stats:", err.message);
    return res.status(500).json({ error: "Failed to fetch stats" });
  }
});

app.delete("/reset", requireAdmin, async (req, res) => {
  try {
    await resetLeaderboard();
    cachedBoardJson = null;
    scheduleBroadcast();
    return res.json({ message: "leaderboard reset" });
  } catch (err) {
    console.error("Error in /reset:", err.message);
    return res.status(500).json({ error: "Failed to reset leaderboard" });
  }
});

server.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`),
);
