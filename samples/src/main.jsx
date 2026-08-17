import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './styles/index.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('未找到应用根节点。');
}

ReactDOM.createRoot(root).render(
  <HashRouter>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </HashRouter>,
);
