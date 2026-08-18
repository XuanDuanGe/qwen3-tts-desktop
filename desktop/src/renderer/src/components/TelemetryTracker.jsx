import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { track } from '../api/telemetry';

const ROUTES = {
  '/': 'home',
  '/voice-generate': 'voice_generate',
  '/voice-clone': 'voice_clone',
  '/settings': 'settings',
};

export default function TelemetryTracker() {
  const location = useLocation();

  useEffect(() => {
    track('app_started', { platform: window.api.platform || 'desktop' }, { once: true });
  }, []);

  useEffect(() => {
    const route = ROUTES[location.pathname];
    if (route) track('page_view', { route });
  }, [location.pathname]);

  return null;
}
