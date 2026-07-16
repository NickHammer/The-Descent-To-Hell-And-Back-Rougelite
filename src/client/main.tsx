import React from 'react';
import { createRoot } from 'react-dom/client';
import { RunApp } from './rogue/RunApp.js';
import './styles.css';

// The Descent is the whole site: every path renders the run (deep links like
// /run from the shared-history days land here too).
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RunApp />
  </React.StrictMode>
);
