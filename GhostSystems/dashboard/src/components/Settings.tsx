import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useApi, ApiProvider } from '../context/ApiContext';

function SettingsContent() {
  const { setApiKey, isAuthenticated } = useApi();
  const [settings, setSettings] = useState<any>(null);
  const [newApiKey, setNewApiKey] = useState('');

  const loadSettings = async () => {
    try {
      const data = await apiClient.getSettings();
      setSettings(data);
    } catch (error: any) {
      console.error('Failed to load settings:', error);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadSettings();
    }
  }, [isAuthenticated]);

  const handleSetApiKey = () => {
    if (newApiKey.trim()) {
      setApiKey(newApiKey.trim());
      setNewApiKey('');
      alert('API key saved!');
    }
  };

  const handleClearApiKey = () => {
    if (confirm('Clear API key? You will need to re-enter it.')) {
      setApiKey('');
      localStorage.removeItem('dashboard_api_key');
      alert('API key cleared');
    }
  };

  return (
    <div>
      <div className="card">
        <h2 className="card-title">Authentication</h2>
        <p className="card-subtitle" style={{ marginBottom: '1rem' }}>
          Set your dashboard API key to access the dashboard
        </p>
        
        {isAuthenticated ? (
          <div>
            <p style={{ marginBottom: '1rem', color: 'var(--success)' }}>
              ✅ Authenticated
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                placeholder="Enter new API key"
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                }}
              />
              <button className="btn btn-primary" onClick={handleSetApiKey}>
                Update Key
              </button>
            </div>
            <button
              className="btn btn-danger btn-small"
              onClick={handleClearApiKey}
              style={{ marginTop: '0.5rem' }}
            >
              Clear API Key
            </button>
          </div>
        ) : (
          <div>
            <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
              Enter your DASHBOARD_API_KEY to authenticate
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                placeholder="Enter API key"
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                }}
              />
              <button className="btn btn-primary" onClick={handleSetApiKey}>
                Set Key
              </button>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              Set DASHBOARD_API_KEY in your Render environment variables
            </p>
          </div>
        )}
      </div>

      {isAuthenticated && settings && (
        <div className="card">
          <h2 className="card-title">Agent Settings</h2>
          <p className="card-subtitle" style={{ marginBottom: '1rem' }}>
            Current configuration (read-only)
          </p>

          <div style={{ marginTop: '1rem' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>Adaptive AI</h3>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              <p>Enabled: {settings.adaptiveAI?.enabled ? 'Yes' : 'No'}</p>
              <p>Interval: {settings.adaptiveAI?.intervalHours || 24} hours</p>
              <p>Products: {settings.adaptiveAI?.minProducts || 3} - {settings.adaptiveAI?.maxProducts || 5}</p>
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>Store Design Agent</h3>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              <p>Enabled: {settings.storeDesign?.enabled ? 'Yes' : 'No'}</p>
              <p>Min Confidence: {(settings.storeDesign?.minConfidence || 0.7) * 100}%</p>
              <p>Auto Apply: {settings.storeDesign?.autoApply ? 'Yes' : 'No'}</p>
              <p>Max Daily Changes: {settings.storeDesign?.maxDailyChanges || 5}</p>
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>Marketing Agent</h3>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              <p>Enabled: {settings.marketing?.enabled ? 'Yes' : 'No'}</p>
              <p>Interval: {settings.marketing?.intervalHours || 24} hours</p>
              <p>Auto Execute: {settings.marketing?.autoExecute ? 'Yes' : 'No'}</p>
              <p>Min Confidence: {(settings.marketing?.minConfidence || 0.75) * 100}%</p>
              <p>Max Daily Campaigns: {settings.marketing?.maxDailyCampaigns || 3}</p>
            </div>
          </div>

          <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              <strong>Note:</strong> To change settings, update environment variables in Render and restart the server.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  return (
    <ApiProvider>
      <SettingsContent />
    </ApiProvider>
  );
}

