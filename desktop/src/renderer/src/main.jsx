import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import EngineBootstrap from './components/EngineBootstrap';
import AppRoutes from './routes/AppRoutes';
import './styles/global.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <EngineBootstrap />
    <AppRoutes />
  </StrictMode>,
);
