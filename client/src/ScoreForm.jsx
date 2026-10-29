import { useCallback, useEffect, useState } from 'react';
import { API_URL } from './config';

const AUTO_PLAY_INTERVAL_MS = 800;

export default function ScoreForm({ name, setName }) {
  const [lastGain, setLastGain] = useState(null);
  const [error, setError] = useState('');
  const [auto, setAuto] = useState(false);

  const play = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter a name first');
      setAuto(false);
      return;
    }

    const points = Math.floor(Math.random() * 100) + 1;

    try {
      const res = await fetch(`${API_URL}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, points }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Request failed');
      setError('');
      setLastGain(points);
    } catch (err) {
      setError(err.message);
      setAuto(false);
    }
  }, [name]);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(play, AUTO_PLAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [auto, play]);

  return (
    <section className="card">
      <h2>Play</h2>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        maxLength={20}
      />
      <div className="button-row">
        <button onClick={play}>Play a round</button>
        <button className={auto ? 'secondary active' : 'secondary'} onClick={() => setAuto((a) => !a)}>
          {auto ? 'Stop auto-play' : 'Auto-play'}
        </button>
      </div>
      {error && <p className="message error">{error}</p>}
      {!error && lastGain && <p className="message">Last round: +{lastGain} points</p>}
    </section>
  );
}