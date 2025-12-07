import { useState } from 'react';
import { apiClient } from '../api/client';

interface Agent {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  status: string;
  lastRun: string | null;
  stats: any;
  error?: string;
}

interface AgentCardProps {
  agent: Agent;
  onRun: () => void;
}

export default function AgentCard({ agent, onRun }: AgentCardProps) {
  const [running, setRunning] = useState(false);

  const handleRun = async () => {
    setRunning(true);
    try {
      await apiClient.triggerAgentRun(agent.id);
      setTimeout(() => {
        setRunning(false);
        onRun();
      }, 2000);
    } catch (error: any) {
      alert(`Failed to run agent: ${error.message}`);
      setRunning(false);
    }
  };

  const getStatusBadgeClass = () => {
    if (!agent.enabled) return 'status-disabled';
    if (agent.error) return 'status-error';
    if (agent.status === 'active') return 'status-active';
    return 'status-idle';
  };

  const formatLastRun = (dateString: string | null) => {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return 'Unknown';
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 className="card-title">{agent.name}</h3>
          <p className="card-subtitle">{agent.description}</p>
        </div>
        <span className={`status-badge ${getStatusBadgeClass()}`}>
          {agent.enabled ? agent.status : 'Disabled'}
        </span>
      </div>

      {agent.error && (
        <div className="error" style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
          Error: {agent.error}
        </div>
      )}

      <div className="stats-grid" style={{ marginTop: '1rem' }}>
        <div className="stat-item">
          <div className="stat-value">{agent.stats?.pending || 0}</div>
          <div className="stat-label">Pending</div>
        </div>
        {agent.stats?.productsGenerated !== undefined && (
          <div className="stat-item">
            <div className="stat-value">{agent.stats.productsGenerated}</div>
            <div className="stat-label">Products</div>
          </div>
        )}
        {agent.stats?.activeCampaigns !== undefined && (
          <div className="stat-item">
            <div className="stat-value">{agent.stats.activeCampaigns}</div>
            <div className="stat-label">Campaigns</div>
          </div>
        )}
        {agent.stats?.successRate !== undefined && (
          <div className="stat-item">
            <div className="stat-value">{agent.stats.successRate.toFixed(0)}%</div>
            <div className="stat-label">Success</div>
          </div>
        )}
      </div>

      <div className="flex-between" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Last run: {formatLastRun(agent.lastRun)}
        </div>
        {agent.enabled && (
          <button
            className="btn btn-primary btn-small"
            onClick={handleRun}
            disabled={running}
          >
            {running ? 'Running...' : 'Run Now'}
          </button>
        )}
      </div>
    </div>
  );
}

