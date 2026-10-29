import { redis } from './redis.js';

const KEY = 'leaderboard';
const DEFAULT_SIZE = 100;
const INITIAL_SCORE = 1000;

export const addScore = async (name, points) => {
  const results = await redis
    .multi()
    .zadd(KEY, 'NX', INITIAL_SCORE, name)
    .zincrby(KEY, points, name)
    .exec();

  if (!results || !results[1] || results[1][0]) {
    throw new Error(results?.[1]?.[0]?.message || 'Redis transaction failed');
  }

  const [, newScore] = results[1];
  return Number(newScore);
};

export const getTop = async (count = DEFAULT_SIZE) => {
  const raw = await redis.zrevrange(KEY, 0, count - 1, 'WITHSCORES');
  if (!raw || raw.length === 0) return [];

  const entries = [];
  for (let i = 0; i < raw.length; i += 2) {
    entries.push({ rank: (i >> 1) + 1, name: raw[i], score: Number(raw[i + 1]) });
  }
  return entries;
};

export const getPlayer = async (name) => {
  const [rank, score] = await Promise.all([
    redis.zrevrank(KEY, name),
    redis.zscore(KEY, name),
  ]);
  if (rank === null || rank === undefined || score === null || score === undefined) return null;
  return { name, rank: rank + 1, score: Number(score) };
};

export const getPlayerCount = () => redis.zcard(KEY);

export const resetLeaderboard = () => redis.del(KEY);
