import { useEffect, useRef } from 'react';
import { measure, remark, track } from '../utils/telemetry';

export function usePageTelemetry(pageName) {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (trackedRef.current) {
      return;
    }

    trackedRef.current = true;
    remark(`page.${pageName}.mount`, { page: pageName });
    measure(`page.${pageName}.ready`, 'app.boot', { page: pageName });
    track(`page.${pageName}.init`, { page: pageName });
  }, [pageName]);
}
