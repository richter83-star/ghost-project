import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from '../api/client';

interface ApiContextType {
  apiKey: string | null;
  setApiKey: (key: string) => void;
  isAuthenticated: boolean;
}

const ApiContext = createContext<ApiContextType | undefined>(undefined);

export function ApiProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState] = useState<string | null>(() => {
    // Load from localStorage
    return localStorage.getItem('dashboard_api_key');
  });

  const setApiKey = (key: string) => {
    setApiKeyState(key);
    localStorage.setItem('dashboard_api_key', key);
    apiClient.setApiKey(key);
  };

  useEffect(() => {
    if (apiKey) {
      apiClient.setApiKey(apiKey);
    }
  }, [apiKey]);

  return (
    <ApiContext.Provider value={{ apiKey, setApiKey, isAuthenticated: !!apiKey }}>
      {children}
    </ApiContext.Provider>
  );
}

export function useApi() {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApi must be used within ApiProvider');
  }
  return context;
}

