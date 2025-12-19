import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { TooltipProvider } from './components/ui';
// CSS is loaded via <link> tag in WebviewProvider.ts, not imported here

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </React.StrictMode>
  );
}
