import Avatar from './Avatar';
import { useScoreDelta } from './hooks';

const ROW_HEIGHT = 52;

function Row({ rank, name, score, index, isMe }) {
    const delta = useScoreDelta(score);

    return (
        <li
            className={`row${isMe ? ' me' : ''}`}
            style={{ transform: `translateY(${index * ROW_HEIGHT}px)` }}
        >
            <span className="rank">{rank}</span>
            <Avatar name={name} size={34} />
            <span className="name">{name}</span>
            {delta > 0 && <span className="delta inline">+{delta}</span>}
            <span className="score">{score.toLocaleString()}</span>
        </li>
    );
}

export default function Leaderboard({ entries, currentName }) {
    const rest = entries.slice(3);
    if (rest.length === 0) return null;

    return (
        <div className="board-scroll">
            <ul className="board" style={{ height: rest.length * ROW_HEIGHT }}>
                {rest.map((entry, index) => (
                    <Row key={entry.name} {...entry} index={index} isMe={entry.name === currentName.trim()} />
                ))}
            </ul>
        </div>
    );
}