import { useEffect } from 'react';
import { onArtifactCreated, onEngineStatus, onJobUpdated } from '../api/engine';
import useArtifactStore from '../store/artifactStore';
import useEngineStore from '../store/engineStore';
import useJobStore from '../store/jobStore';
import { track } from '../api/telemetry';

export default function EngineBootstrap() {
  useEffect(() => {
    track('component_used', { component: 'engine_bootstrap' }, { once: true });
    track('engine_bootstrap_started', {}, { once: true });
    useEngineStore.getState().initialize();
    const unsubscribeStatus = onEngineStatus((status) => {
      useEngineStore.getState().setStatus(status);
      if (status === 'ready') {
        track('engine_ready', {}, { once: true });
        useEngineStore.getState().initialize();
      } else if (status === 'unavailable') {
        track('engine_unavailable', {}, { once: true });
      }
    });
    const unsubscribeJob = onJobUpdated(useJobStore.getState().update);
    const unsubscribeArtifact = onArtifactCreated(
      useArtifactStore.getState().add,
    );

    return () => {
      unsubscribeStatus();
      unsubscribeJob();
      unsubscribeArtifact();
    };
  }, []);

  return null;
}
