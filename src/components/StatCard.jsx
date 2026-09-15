export default function StatCard({ title, value, detail, tone = 'default', badge }) {
  return (
    <div className="stat-card glass-panel">
      <div className="stat-header">
        <span className="stat-title">{title}</span>
        {badge ? <span className={`badge ${tone}`}>{badge}</span> : null}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-detail">{detail}</div>
    </div>
  );
}
