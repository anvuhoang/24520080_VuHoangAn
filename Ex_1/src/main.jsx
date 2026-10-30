// src/main.jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Mount failed: element #root not found in index.html.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
