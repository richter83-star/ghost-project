import { useApi } from '../context/ApiContext';

export default function LogsViewer() {
  const { isAuthenticated } = useApi();

  if (!isAuthenticated) {
    return (
      <div className="card">
        <h2>Authentication Required</h2>
        <p>Please set your API key in Settings.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <h2 className="card-title">Logs Viewer</h2>
        <p className="card-subtitle">Real-time log streaming coming soon</p>
      </div>

      <div className="card">
        <p style={{ marginBottom: '1rem' }}>
          For now, view logs in your Render dashboard:
        </p>
        <ol style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }}>
          <li>Go to your Render dashboard</li>
          <li>Select your Ghost Systems service</li>
          <li>Click on the "Logs" tab</li>
          <li>Filter by agent name (e.g., "[AdaptiveAI]", "[MarketingAgent]")</li>
        </ol>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Real-time log streaming will be available in a future update.
        </p>
      </div>
    </div>
  );
}

