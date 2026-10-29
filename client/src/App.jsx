import { useEffect, useState } from 'react';
import { useLeaderboard, useStats, useMyRank } from './hooks';
import ScoreForm from './ScoreForm';
import Podium from './Podium';
import Leaderboard from './Leaderboard';
import './index.css';

export default function App() {
  const [name, setName] = useState(() => localStorage.getItem('leaderboard-name') ?? '');
  const { entries, status } = useLeaderboard();
  const stats = useStats();
  const me = useMyRank(name);

  useEffect(() => {
    localStorage.setItem('leaderboard-name', name);
  }, [name]);

  return (
    <main className="app">
      <header className="header">
        <div>
          <h1>Live Leaderboard</h1>
          <p className="subtitle">Powered by Redis sorted sets</p>
        </div>
        <span className={`status ${status}`}>
          <i className="dot" />
          {status}
        </span>
      </header>

      <section className="stats">
        <div className="stat">
          <span className="stat-value">{stats.totalPlayers.toLocaleString()}</span>
          <span className="stat-label">Players</span>
        </div>
        <div className="stat">
          <span className="stat-value">{stats.connectedViewers.toLocaleString()}</span>
          <span className="stat-label">Watching live</span>
        </div>
        <div className="stat">
          <span className="stat-value">{entries[0]?.score.toLocaleString() ?? '-'}</span>
          <span className="stat-label">Top score</span>
        </div>
      </section>

      <div className="layout">
        <div className="side">
          <ScoreForm name={name} setName={setName} />

          <section className="card">
            <h2>Your rank</h2>
            {me ? (
              <div className="my-rank">
                <span className="my-rank-number">#{me.rank}</span>
                <span className="my-rank-score">{me.score.toLocaleString()} pts</span>
              </div>
            ) : (
              <p className="muted">{name.trim() ? 'Not on the board yet. Play a round.' : 'Enter a name to see your rank.'}</p>
            )}
          </section>
        </div>

        <section className="card">
          <h2>Top 10</h2>
          {entries.length === 0 ? (
            <p className="muted">No players yet. Play a round to get on the board.</p>
          ) : (
            <>
              <Podium entries={entries} currentName={name} />
              <Leaderboard entries={entries} currentName={name} />
            </>
          )}
        </section>
      </div>
    </main>
  );
}