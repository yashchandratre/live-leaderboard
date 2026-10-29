import Avatar from './Avatar';
import { useScoreDelta } from './hooks';

function PodiumCard({ rank, name, score, isMe }) {
  const delta = useScoreDelta(score);

  return (
    <div className={`podium-card rank-${rank}${isMe ? ' me' : ''}`}>
      {delta > 0 && <span className="delta">+{delta}</span>}
      <Avatar name={name} size={rank === 1 ? 64 : 52} />
      <div className="podium-name">{name}</div>
      <div className="podium-score">{score.toLocaleString()}</div>
      <div className="podium-rank">{rank}</div>
    </div>
  );
}

export default function Podium({ entries, currentName }) {
  const top = entries.slice(0, 3);
  if (top.length === 0) return null;

  // Visual order: 2nd, 1st, 3rd
  const display = [top[1], top[0], top[2]].filter(Boolean);

  return (
    <div className="podium">
      {display.map((entry) => (
        <PodiumCard key={entry.name} {...entry} isMe={entry.name === currentName.trim()} />
      ))}
    </div>
  );
}