import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useApi } from '../context/ApiContext';

interface Output {
  id: string;
  agent: string;
  agentName: string;
  type: string;
  title: string;
  status: string;
  createdAt: string;
  metadata?: any;
}

export default function OutputsFeed() {
  const { isAuthenticated } = useApi();
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOutputs = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getOutputs(50);
      setOutputs(data.outputs || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load outputs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadOutputs();
      // Poll every 60 seconds
      const interval = setInterval(loadOutputs, 60000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'product': return '📦';
      case 'campaign': return '📢';
      case 'design_change': return '🎨';
      default: return '📄';
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="card">
        <h2>Authentication Required</h2>
        <p>Please set your API key in Settings.</p>
      </div>
    );
  }

  if (loading && outputs.length === 0) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading activity...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Recent Activity</h2>
          <button className="btn btn-secondary btn-small" onClick={loadOutputs}>
            Refresh
          </button>
        </div>
        <p className="card-subtitle">{outputs.length} recent outputs</p>
      </div>

      {error && (
        <div className="error">{error}</div>
      )}

      {outputs.length === 0 ? (
        <div className="card">
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
            No recent activity
          </p>
        </div>
      ) : (
        <ul className="list">
          {outputs.map(output => (
            <li key={output.id} className="list-item">
              <div className="flex gap-2" style={{ alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1.5rem' }}>{getTypeIcon(output.type)}</span>
                <div style={{ flex: 1 }}>
                  <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                    <h3>{output.title}</h3>
                    <span
                      className={`status-badge ${
                        output.status === 'completed' || output.status === 'published'
                          ? 'status-active'
                          : output.status === 'failed'
                          ? 'status-error'
                          : 'status-idle'
                      }`}
                    >
                      {output.status}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    {output.agentName} • {output.type}
                  </p>
                  {output.metadata && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {output.metadata.productType && `Type: ${output.metadata.productType}`}
                      {output.metadata.price && ` • Price: $${output.metadata.price}`}
                      {output.metadata.metrics && ` • Metrics: ${JSON.stringify(output.metadata.metrics).substring(0, 50)}...`}
                    </div>
                  )}
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    {formatDate(output.createdAt)}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

