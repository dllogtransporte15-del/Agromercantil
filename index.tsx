
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

import { ToastProvider } from './hooks/useToast';
import { ToastContainer } from './components/Toast';
import { ReloadPrompt } from './components/ReloadPrompt';
import { BrowserRouter } from 'react-router-dom';

import ErrorBoundary from './components/ErrorBoundary';
import { SupabaseAuthProvider } from './hooks/useSupabaseAuth';

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <SupabaseAuthProvider>
          <ToastProvider>
            <App />
            <ToastContainer />
            <ReloadPrompt />
          </ToastProvider>
        </SupabaseAuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);

