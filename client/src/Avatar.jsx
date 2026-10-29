const hueFromName = (name) =>
  [...(name || '')].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 360, 0);

export default function Avatar({ name, size = 40 }) {
  const safeName = (name || '').trim();
  const initials = safeName.length === 0
    ? '?'
    : safeName.length === 1
      ? safeName.toUpperCase()
      : `${safeName[0]}${safeName.slice(-1)}`.toUpperCase();

  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `hsl(${hueFromName(safeName || 'user')} 55% 42%)`,
      }}
    >
      {initials}
    </div>
  );
}
