import React from 'react';
import ReactDOM from 'react-dom/client';

const TestApp = () => {
  return (
    <div style={{ 
      padding: '50px', 
      color: 'white', 
      background: '#1e293b',
      minHeight: '100vh',
      fontFamily: 'sans-serif'
    }}>
      <h1 style={{ color: '#3b82f6' }}>✅ React is Working!</h1>
      <p>If you see this, React is rendering correctly.</p>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<TestApp />);
}

