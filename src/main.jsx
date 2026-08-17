import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppLayout from './components/AppLayout';
import { mark, trackOnce } from './utils/telemetry';
import './styles/global.css';

mark('app.boot', { stage: 'module-evaluated' });

const root = document.getElementById('root');

if (!root) {
  throw new Error('未找到应用根节点。');
}

trackOnce('app.root.created', { hasRoot: true });

createRoot(root).render(
  <StrictMode>
    <AppLayout />
  </StrictMode>
);
