import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// CSS is loaded via <link> tag in WebviewProvider.ts, not imported here

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
