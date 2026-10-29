import { WebSocket } from "ws";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const WS_URL = BASE_URL.replace("http", "ws");

const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 4000);
const FAIL_RATE = Number(process.env.FAIL_RATE ?? 0);

// node simulate.js <players> <viewers> <seconds>
const [players = 100, viewers = 50, seconds = 30] = process.argv
  .slice(2)
  .map(Number);

const MIN_DELAY_MS = 200;
const MAX_DELAY_MS = 1000;

const stats = { sent: 0, ok: 0, failed: 0, messages: 0, latencies: [] };
let running = true;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomBetween = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

// One simulated player: keeps submitting scores at random intervals
const runPlayer = async (id) => {
  const name = `player-${id}`;
  await sleep(randomBetween(0, 1000)); // stagger so they don't all start together

  while (running) {
    const start = performance.now();
    stats.sent++;
    const sendBad = Math.random() < FAIL_RATE;
    try {
      const res = await fetch(`${BASE_URL}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          sendBad
            ? { name: "", points: "abc" }
            : { name, points: randomBetween(1, 100) },
        ),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      stats.ok++;
      stats.latencies.push(performance.now() - start);
    } catch {
      stats.failed++;
    }

    await sleep(randomBetween(MIN_DELAY_MS, MAX_DELAY_MS));
  }
};

// Simulated viewers connected with staggered ramp-up
const runViewer = async (delayMs) => {
  if (delayMs > 0) await sleep(delayMs);
  if (!running) return null;

  const socket = new WebSocket(WS_URL);
  socket.on("message", () => stats.messages++);
  socket.on("error", () => {});
  return socket;
};

const percentile = (sorted, p) => sorted[Math.floor(sorted.length * p)] ?? 0;

const report = (() => {
  let last = { ok: 0, failed: 0, messages: 0 };
  let second = 0;

  return () => {
    const sorted = stats.latencies.sort((a, b) => a - b);
    console.log(
      `t=${String(++second).padStart(3)}s | ` +
        `req/s: ${stats.ok - last.ok} | failed: ${stats.failed - last.failed} | ` +
        `updates received/s: ${stats.messages - last.messages} | ` +
        `latency p50: ${percentile(sorted, 0.5).toFixed(0)}ms, p95: ${percentile(sorted, 0.95).toFixed(0)}ms`,
    );
    last = { ok: stats.ok, failed: stats.failed, messages: stats.messages };
    stats.latencies = [];
  };
})();

console.log(
  `Simulating ${players} players and ${viewers} viewers for ${seconds}s on ${BASE_URL}`,
);

// Connect viewers in small batches over 1.5 seconds to avoid OS TCP handshake saturation
const BATCH_SIZE = 50;
const viewerPromises = [];
for (let i = 0; i < viewers; i++) {
  const batchIdx = Math.floor(i / BATCH_SIZE);
  viewerPromises.push(runViewer(batchIdx * 20));
}

const playerTasks = Array.from({ length: players }, (_, i) => runPlayer(i + 1));
const timer = setInterval(report, 1000);

await sleep(seconds * 1000);
running = false;
await Promise.all(playerTasks);

clearInterval(timer);
const sockets = (await Promise.all(viewerPromises)).filter(Boolean);
sockets.forEach((socket) => socket.close());

console.log(
  `\nDone. Sent: ${stats.sent}, OK: ${stats.ok}, Failed: ${stats.failed}`,
);
process.exit(0);
