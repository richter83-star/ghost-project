import { useState } from 'react';
import Dashboard from './components/Dashboard';
import RecommendationsList from './components/RecommendationsList';
import OutputsFeed from './components/OutputsFeed';
import LogsViewer from './components/LogsViewer';
import Settings from './components/Settings';
import { ApiProvider } from './context/ApiContext';
import Navigation from './components/Navigation';

type View = 'dashboard' | 'recommendations' | 'outputs' | 'logs' | 'settings';

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'recommendations':
        return <RecommendationsList />;
      case 'outputs':
        return <OutputsFeed />;
      case 'logs':
        return <LogsViewer />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <ApiProvider>
      <div className="app">
        <header className="app-header">
          <h1>Ghost Fleet Controller</h1>
          <div className="header-subtitle">AI Agent Dashboard</div>
        </header>
        <main className="app-main">
          {renderView()}
        </main>
        <Navigation currentView={currentView} onNavigate={setCurrentView} />
      </div>
    </ApiProvider>
  );
}

export default App;

