export default function Loading() {
  const skeletons = Array.from({ length: 6 });
  return (
    <div>
      <div className="category-tabs" style={{ marginBottom: 20 }}>
        <div className="skeleton" style={{ height: 32, width: "100%", borderRadius: 8 }} />
      </div>
      <div className="search-bar" style={{ marginBottom: 16 }}>
        <div className="skeleton" style={{ height: 36, width: "100%", borderRadius: 8 }} />
      </div>
      <div className="records-list">
        {skeletons.map((_, i) => (
          <div key={i} className="skeleton-card">
            <div className="skeleton skeleton-thumb" />
            <div className="skeleton-body">
              <div className="skeleton skeleton-line shorter" />
              <div className="skeleton skeleton-line" style={{ marginTop: 8 }} />
              <div className="skeleton skeleton-line short" style={{ marginTop: 6 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}