export default function StatusTimeline({ history }) {
  if (!history || history.length === 0) return <p>No status history yet.</p>;
  return (
    <ul className="timeline">
      {history.map((entry) => (
        <li key={entry._id} className="timeline-item">
          <div className="timeline-dot" />
          <div>
            <strong>{entry.status}</strong>
            <div className="timeline-meta">
              {new Date(entry.timestamp).toLocaleString()} · by{' '}
              {entry.actor?.name || entry.actorRole} ({entry.actorRole})
            </div>
            {entry.note && <div className="timeline-note">{entry.note}</div>}
          </div>
        </li>
      ))}
    </ul>
  );
}
