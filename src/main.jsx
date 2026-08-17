import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppLayout from './components/AppLayout';
import './styles/global.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('未找到应用根节点。');
}

createRoot(root).render(
  <StrictMode>
    <AppLayout />
  </StrictMode>
);
