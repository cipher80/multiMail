export default function SendStatus({ results, onReset }) {
  const sentCount   = results.filter((r) => r.status === 'sent').length;
  const failedCount = results.filter((r) => r.status === 'failed').length;
  const allSent     = failedCount === 0;

  return (
    <div className="main-grid" style={{ maxWidth: '860px', width: '100%' }}>
      <div className="status-card card" style={{ padding: 0 }}>
        <div className="status-header">
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 8 }}>
              {allSent ? '🎉 All Emails Sent!' : '⚠️ Send Complete — Some Failures'}
            </div>
            <div className="status-summary">
              {sentCount > 0 && (
                <span className="status-pill sent">✓ {sentCount} Sent</span>
              )}
              {failedCount > 0 && (
                <span className="status-pill failed">✗ {failedCount} Failed</span>
              )}
            </div>
          </div>
          <button id="reset-btn" className="btn-reset" onClick={onReset}>
            ← New Email
          </button>
        </div>

        <div className="status-list">
          {results.map((r, i) => (
            <div
              className="status-row"
              key={r.recipient + i}
              style={{ animationDelay: `${i * 0.06}s`, animationFillMode: 'forwards' }}
            >
              <span className="status-icon">
                {r.status === 'sent' ? '✅' : '❌'}
              </span>
              <div style={{ flex: 1 }}>
                <div className="status-email">{r.recipient}</div>
                {r.error && <div className="status-error">{r.error}</div>}
              </div>
              <span className={`status-badge ${r.status}`}>
                {r.status === 'sent' ? 'Sent' : 'Failed'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="privacy-note">
        🔒 Each recipient received a separate, private email
      </p>
    </div>
  );
}
