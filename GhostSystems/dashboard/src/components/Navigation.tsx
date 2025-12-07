
type View = 'dashboard' | 'recommendations' | 'outputs' | 'logs' | 'settings';

interface NavigationProps {
  currentView: View;
  onNavigate: (view: View) => void;
}

export default function Navigation({ currentView, onNavigate }: NavigationProps) {
  const navItems = [
    { id: 'dashboard' as View, label: 'Home', icon: '🏠' },
    { id: 'recommendations' as View, label: 'Pending', icon: '📋' },
    { id: 'outputs' as View, label: 'Activity', icon: '📊' },
    { id: 'logs' as View, label: 'Logs', icon: '📝' },
    { id: 'settings' as View, label: 'Settings', icon: '⚙️' },
  ];

  return (
    <nav className="bottom-nav">
      {navItems.map(item => (
        <button
          key={item.id}
          className={`nav-item ${currentView === item.id ? 'active' : ''}`}
          onClick={() => onNavigate(item.id)}
        >
          <span className="nav-item-icon">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

