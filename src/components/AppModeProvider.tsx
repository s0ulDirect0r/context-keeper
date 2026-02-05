'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

interface AppModeContextValue {
  isAppMode: boolean;
  setAppMode: (value: boolean) => void;
}

const AppModeContext = createContext<AppModeContextValue | null>(null);

export function AppModeProvider({ children }: { children: ReactNode }) {
  const [isAppMode, setAppMode] = useState(false);

  return (
    <AppModeContext.Provider value={{ isAppMode, setAppMode }}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  const context = useContext(AppModeContext);
  if (!context) {
    throw new Error('useAppMode must be used within AppModeProvider');
  }
  return context;
}
