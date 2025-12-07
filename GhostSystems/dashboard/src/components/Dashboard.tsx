import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import AgentCard from './AgentCard';
import { useApi } from '../context/ApiContext';

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

export default function Dashboard() {
  const { isAuthenticated } = useApi();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const loadAgents = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getAgents();
      setAgents(data.agents || []);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load agents');
      console.error('Failed to load agents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadAgents();
      // Poll every 30 seconds
      const interval = setInterval(loadAgents, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="card">
        <h2>Authentication Required</h2>
        <p>Please set your API key in Settings to access the dashboard.</p>
      </div>
    );
  }

  if (loading && agents.length === 0) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading agents...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">AI Agents Overview</h2>
            <p className="card-subtitle">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          </div>
          <button className="btn btn-secondary btn-small" onClick={loadAgents}>
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      {agents.map(agent => (
        <AgentCard key={agent.id} agent={agent} onRun={() => loadAgents()} />
      ))}
    </div>
  );
}

