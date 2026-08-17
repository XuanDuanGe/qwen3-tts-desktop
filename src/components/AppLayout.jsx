import { useEffect, useRef } from 'react';
import { HashRouter, useLocation } from 'react-router-dom';
import AppRoutes from '../routes/AppRoutes';
import { measure, trackOnce, trackPageView } from '../utils/telemetry';
import Sidebar from './Sidebar';
import TitleBar from './TitleBar';

function LayoutShell() {
  const location = useLocation();
  const mountedRef = useRef(false);
  const firstRouteReadyRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      measure('app.layout.mounted', 'app.boot', { pathname: location.pathname });
      trackOnce('app.layout.ready', { pathname: location.pathname });
    }
  }, [location.pathname]);

  useEffect(() => {
    trackPageView(location.pathname, { hash: window.location.hash });

    if (!firstRouteReadyRef.current) {
      firstRouteReadyRef.current = true;
      measure('app.first.route.ready', 'app.boot', { pathname: location.pathname });
    }
  }, [location.pathname]);

  return (
    <main className="flex h-screen min-h-[600px] min-w-[900px] flex-col overflow-hidden bg-canvas text-text">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <div className="min-w-0 flex-1 overflow-y-auto bg-surface">
          <AppRoutes />
        </div>
      </div>
    </main>
  );
}

export default function AppLayout() {
  return (
    <HashRouter>
      <LayoutShell />
    </HashRouter>
  );
}
