export default function Loading() {
  return (
    <div className="detail-view">
      <div className="detail-back-link skeleton" style={{ width: 80, height: 28 }} />

      <div className="detail-meta">
        <div className="skeleton" style={{ width: 84, height: 14, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: 66, height: 20, borderRadius: 3 }} />
        <div className="skeleton" style={{ width: 40, height: 20, borderRadius: 3 }} />
        <div className="skeleton" style={{ width: 54, height: 20, borderRadius: 3 }} />
      </div>

      <div className="detail-title skeleton" style={{ width: "100%", height: 34, borderRadius: 4 }} />

      <div className="detail-thumbnail skeleton" style={{ width: "100%", minHeight: 200 }}>
        <div className="skeleton" style={{ width: 48, height: 48, borderRadius: "50%" }} />
      </div>

      <div className="detail-attachments">
        <div className="detail-attachments-title skeleton" style={{ width: 150, height: 16, borderRadius: 4 }} />
        <div className="detail-attachment-item">
          <div className="skeleton" style={{ flex: 1, height: 12, borderRadius: 4 }} />
          <div className="skeleton" style={{ width: 48, height: 12, borderRadius: 4 }} />
        </div>
      </div>

      <div className="detail-content">
        <div className="skeleton" style={{ width: "100%", height: 16, marginBottom: 12, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: "100%", height: 16, marginBottom: 12, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: "100%", height: 16, marginBottom: 12, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: "100%", height: 16, marginBottom: 12, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: "100%", height: 16, marginBottom: 24, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: "55%", height: 20, marginBottom: 12, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: "100%", height: 16, marginBottom: 12, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: "100%", height: 16, borderRadius: 4 }} />
      </div>

      <nav className="detail-nav">
        <div className="skeleton" style={{ width: "32%", height: 40, borderRadius: 6 }} />
        <div className="skeleton" style={{ width: 80, height: 32, borderRadius: 6 }} />
        <div className="skeleton" style={{ width: "32%", height: 40, borderRadius: 6 }} />
      </nav>

      <div className="similar-section">
        <div className="similar-title skeleton" style={{ width: 150, height: 16, marginBottom: 16, borderRadius: 4 }} />
        <div className="similar-list">
          <div className="similar-item">
            <div className="similar-item-icon skeleton" style={{ width: 32, height: 32, flexShrink: 0 }} />
            <div className="similar-item-body">
              <div className="skeleton" style={{ width: "100%", height: 14, marginBottom: 6, borderRadius: 4 }} />
              <div className="skeleton" style={{ width: "50%", height: 12, borderRadius: 4 }} />
            </div>
          </div>
          <div className="similar-item">
            <div className="similar-item-icon skeleton" style={{ width: 32, height: 32, flexShrink: 0 }} />
            <div className="similar-item-body">
              <div className="skeleton" style={{ width: "100%", height: 14, marginBottom: 6, borderRadius: 4 }} />
              <div className="skeleton" style={{ width: "45%", height: 12, borderRadius: 4 }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
