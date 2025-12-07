import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import RecommendationDetail from './RecommendationDetail';
import { useApi } from '../context/ApiContext';

interface Recommendation {
  id: string;
  agent: string;
  agentName: string;
  type: string;
  title: string;
  description: string;
  priority: string;
  metrics: {
    confidence: number;
    expectedImpact: number;
  };
  status: string;
  createdAt: string;
}

export default function RecommendationsList() {
  const { isAuthenticated } = useApi();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getRecommendations();
      setRecommendations(data.recommendations || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadRecommendations();
      // Poll every 60 seconds
      const interval = setInterval(loadRecommendations, 60000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const handleRecommendationClick = async (rec: Recommendation) => {
    try {
      const fullRec = await apiClient.getRecommendation(rec.id, rec.agent);
      setSelectedRec({ ...rec, ...fullRec });
    } catch (err: any) {
      alert(`Failed to load recommendation: ${err.message}`);
    }
  };

  const handleBack = () => {
    setSelectedRec(null);
    loadRecommendations();
  };

  if (!isAuthenticated) {
    return (
      <div className="card">
        <h2>Authentication Required</h2>
        <p>Please set your API key in Settings.</p>
      </div>
    );
  }

  if (selectedRec) {
    return <RecommendationDetail recommendation={selectedRec} onBack={handleBack} />;
  }

  if (loading && recommendations.length === 0) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading recommendations...</p>
      </div>
    );
  }

  const priorityColors: Record<string, string> = {
    high: 'var(--error)',
    medium: 'var(--warning)',
    low: 'var(--text-secondary)',
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Pending Recommendations</h2>
          <button className="btn btn-secondary btn-small" onClick={loadRecommendations}>
            Refresh
          </button>
        </div>
        <p className="card-subtitle">{recommendations.length} pending</p>
      </div>

      {error && (
        <div className="error">{error}</div>
      )}

      {recommendations.length === 0 ? (
        <div className="card">
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
            No pending recommendations
          </p>
        </div>
      ) : (
        <ul className="list">
          {recommendations.map(rec => (
            <li
              key={rec.id}
              className="list-item"
              onClick={() => handleRecommendationClick(rec)}
            >
              <div className="flex-between">
                <div style={{ flex: 1 }}>
                  <div className="flex gap-1" style={{ alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        background: priorityColors[rec.priority] || 'var(--accent)',
                        color: 'white',
                        fontWeight: 600,
                      }}
                    >
                      {rec.priority}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {rec.agentName}
                    </span>
                  </div>
                  <h3 style={{ marginBottom: '0.5rem' }}>{rec.title}</h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    {rec.description.substring(0, 100)}...
                  </p>
                  <div className="flex gap-2" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <span>Confidence: {(rec.metrics.confidence * 100).toFixed(0)}%</span>
                    <span>Impact: {rec.metrics.expectedImpact}%</span>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

