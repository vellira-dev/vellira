import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@vellira-ui/tokens/css';
import '@vellira-ui/react/styles';

import App from './App';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing React root');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
