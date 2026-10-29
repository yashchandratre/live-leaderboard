import { useEffect, useRef, useState } from 'react';
import { API_URL, WS_URL } from './config';

// Live board over WebSocket, with auto-reconnect
export const useLeaderboard = () => {
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    let socket;
    let retryTimer;
    let closedByUs = false;

    const connect = () => {
      setStatus('connecting');
      try {
        socket = new WebSocket(WS_URL);
      } catch {
        if (!closedByUs) {
          setStatus('reconnecting');
          retryTimer = setTimeout(connect, 2000);
        }
        return;
      }

      socket.onopen = () => setStatus('live');
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'leaderboard' && Array.isArray(message.data)) {
            setEntries(message.data);
          }
        } catch {
          // ignore corrupted messages
        }
      };
      socket.onerror = () => {
        // triggers close event
      };
      socket.onclose = () => {
        if (closedByUs) return;
        setStatus('reconnecting');
        retryTimer = setTimeout(connect, 2000);
      };
    };

    connect();
    return () => {
      closedByUs = true;
      clearTimeout(retryTimer);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, []);

  return { entries, status };
};

// Total players and connected viewers, polled every 3s
export const useStats = () => {
  const [stats, setStats] = useState({ connectedViewers: 0, totalPlayers: 0 });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/stats`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data) {
          setStats({
            connectedViewers: Number(data.connectedViewers) || 0,
            totalPlayers: Number(data.totalPlayers) || 0,
          });
        }
      } catch {
        /* server down, keep the last values */
      }
    };
    load();
    const id = setInterval(load, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return stats;
};

// The current player's own rank, even when outside the top 10
export const useMyRank = (name) => {
  const [player, setPlayer] = useState(null);

  useEffect(() => {
    const trimmed = name?.trim() ?? '';
    if (!trimmed) {
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/players/${encodeURIComponent(trimmed)}`);
        if (!cancelled) {
          setPlayer(res.ok ? await res.json() : null);
        }
      } catch {
        if (!cancelled) setPlayer(null);
      }
    };

    load();
    const id = setInterval(load, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [name]);

  const trimmed = name?.trim() ?? '';
  return trimmed ? player : null;
};

// How many points a score just gained (resets to 0 after 1.5s)
export const useScoreDelta = (score) => {
  const previous = useRef(score);
  const [delta, setDelta] = useState(0);

  useEffect(() => {
    if (score === previous.current) return;
    setDelta(score - previous.current);
    previous.current = score;
    const id = setTimeout(() => setDelta(0), 1500);
    return () => clearTimeout(id);
  }, [score]);

  return delta;
};
