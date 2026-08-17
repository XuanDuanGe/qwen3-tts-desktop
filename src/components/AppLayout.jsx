import { HashRouter } from 'react-router-dom';
import AppRoutes from '../routes/AppRoutes';
import Sidebar from './Sidebar';
import TitleBar from './TitleBar';

export default function AppLayout() {
  return (
    <HashRouter>
      <main className="flex h-screen min-h-[600px] min-w-[900px] flex-col overflow-hidden bg-canvas text-text">
        <TitleBar />
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <div className="min-w-0 flex-1 overflow-y-auto bg-surface">
            <AppRoutes />
          </div>
        </div>
      </main>
    </HashRouter>
  );
}
