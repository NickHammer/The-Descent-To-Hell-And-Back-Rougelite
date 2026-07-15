import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { Privacy } from './Privacy.js';
import { Rules } from './Rules.js';
import './styles.css';

// Static content pages are reached by full page loads (plain <a> links), so a
// path check at boot is all the routing we need — no socket on these pages.
function pageForPath() {
  switch (location.pathname) {
    case '/rules':
      return <Rules />;
    case '/privacy':
      return <Privacy />;
    default:
      return <App />;
  }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{pageForPath()}</React.StrictMode>
);
