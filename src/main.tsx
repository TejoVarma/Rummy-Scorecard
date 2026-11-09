import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ThemeProvider } from './themes/ThemeContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { hydrateFromPreferences } from './storage/localStorageAdapter';
import './index.css';

// Restore anything Android kept that the WebView lost before the app reads saved games.
hydrateFromPreferences().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
});
