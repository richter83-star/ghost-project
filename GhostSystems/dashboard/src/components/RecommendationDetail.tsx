import { useState } from 'react';
import { apiClient } from '../api/client';

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
  implementation?: any;
  currentState?: string;
  proposedState?: string;
}

interface RecommendationDetailProps {
  recommendation: Recommendation;
  onBack: () => void;
}

export default function RecommendationDetail({ recommendation, onBack }: RecommendationDetailProps) {
  const [processing, setProcessing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const handleApprove = async () => {
    if (!confirm('Approve this recommendation?')) return;

    setProcessing(true);
    try {
      await apiClient.approveRecommendation(recommendation.id, recommendation.agent);
      alert('Recommendation approved!');
      onBack();
    } catch (error: any) {
      alert(`Failed to approve: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!confirm('Reject this recommendation?')) return;

    setProcessing(true);
    try {
      await apiClient.rejectRecommendation(recommendation.id, recommendation.agent, rejectReason || undefined);
      alert('Recommendation rejected');
      onBack();
    } catch (error: any) {
      alert(`Failed to reject: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <button className="btn btn-secondary btn-small" onClick={onBack}>
            ← Back
          </button>
        </div>
        <h2 className="card-title" style={{ marginTop: '1rem' }}>{recommendation.title}</h2>
        <p className="card-subtitle">{recommendation.agentName}</p>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Description</h3>
        <p>{recommendation.description}</p>
      </div>

      {recommendation.currentState && (
        <div className="card">
          <h3 style={{ marginBottom: '0.5rem' }}>Current State</h3>
          <p style={{ color: 'var(--text-secondary)' }}>{recommendation.currentState}</p>
        </div>
      )}

      {recommendation.proposedState && (
        <div className="card">
          <h3 style={{ marginBottom: '0.5rem' }}>Proposed Change</h3>
          <p style={{ color: 'var(--text-secondary)' }}>{recommendation.proposedState}</p>
        </div>
      )}

      <div className="card">
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-value">{(recommendation.metrics.confidence * 100).toFixed(0)}%</div>
            <div className="stat-label">Confidence</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{recommendation.metrics.expectedImpact}%</div>
            <div className="stat-label">Expected Impact</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{recommendation.priority}</div>
            <div className="stat-label">Priority</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{recommendation.type}</div>
            <div className="stat-label">Type</div>
          </div>
        </div>
      </div>

      {recommendation.implementation?.steps && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Implementation Steps</h3>
          <ol style={{ paddingLeft: '1.5rem' }}>
            {recommendation.implementation.steps.map((step: string, idx: number) => (
              <li key={idx} style={{ marginBottom: '0.5rem' }}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Actions</h3>
        <div className="flex gap-2" style={{ flexDirection: 'column' }}>
          <button
            className="btn btn-success"
            onClick={handleApprove}
            disabled={processing}
          >
            ✅ Approve
          </button>
          <div>
            <textarea
              placeholder="Rejection reason (optional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                marginBottom: '0.5rem',
                minHeight: '80px',
                fontFamily: 'inherit',
              }}
            />
            <button
              className="btn btn-danger"
              onClick={handleReject}
              disabled={processing}
            >
              ❌ Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

