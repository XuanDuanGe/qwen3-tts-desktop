import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { track } from '../api/telemetry';
import { APP_ROUTE_BY_PATH } from '../routes/config';

export default function TelemetryTracker() {
  const location = useLocation();

  useEffect(() => {
    track('app_started', { platform: window.api.platform || 'desktop' }, { once: true });
  }, []);

  useEffect(() => {
    const route = APP_ROUTE_BY_PATH[location.pathname];
    if (route) track('page_view', { route });
  }, [location.pathname]);

  return null;
}
