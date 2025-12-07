import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './prisma/components/App';
import { Providers } from './components/Providers';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

// Simple error boundary using functional component with error handling
const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasError, setHasError] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Global error:', event.error);
      setError(event.error);
      setHasError(true);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      setError(event.reason instanceof Error ? event.reason : new Error(String(event.reason)));
      setHasError(true);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  if (hasError) {
    return (
      <div style={{ 
        padding: '20px', 
        color: 'white', 
        background: '#1e293b',
        minHeight: '100vh',
        fontFamily: 'monospace'
      }}>
        <h1 style={{ color: '#ef4444' }}>⚠️ Error Loading App</h1>
        <pre style={{ background: '#0f172a', padding: '10px', borderRadius: '4px', overflow: 'auto', fontSize: '12px' }}>
          {error?.stack || error?.message || 'Unknown error'}
        </pre>
        <button 
          onClick={() => window.location.reload()}
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Reload Page
        </button>
      </div>
    );
  }

  return <>{children}</>;
};

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <Providers>
        <App />
      </Providers>
    </ErrorBoundary>
  </React.StrictMode>
);
