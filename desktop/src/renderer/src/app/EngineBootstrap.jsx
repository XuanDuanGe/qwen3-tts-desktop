import { useEffect } from 'react';
import { onArtifactCreated, onEngineStatus, onJobUpdated } from '../api/engine';
import { track } from '../api/telemetry';
import useArtifactStore from '../store/artifactStore';
import useEngineStore from '../store/engineStore';
import useJobStore from '../store/jobStore';
import useMessageStore from '../store/messageStore';

export default function EngineBootstrap() {
  useEffect(() => {
    track('component_used', { component: 'engine_bootstrap' }, { once: true });
    track('engine_bootstrap_started', {}, { once: true });
    const unsubscribeStatus = onEngineStatus((status) => {
      useEngineStore.getState().setStatus(status);
      if (status === 'ready') {
        track('engine_ready', {}, { once: true });
        void useEngineStore.getState().initialize();
      } else if (status === 'unavailable') {
        track('engine_unavailable', {}, { once: true });
      }
    });
    void useEngineStore.getState().initialize();
    const unsubscribeJob = onJobUpdated(useJobStore.getState().update);
    const unsubscribeArtifact = onArtifactCreated((artifact) => {
      useArtifactStore.getState().add(artifact);
      useMessageStore
        .getState()
        .push({ level: 'success', content: '语音生成任务已完成。' });
    });

    return () => {
      unsubscribeStatus();
      unsubscribeJob();
      unsubscribeArtifact();
    };
  }, []);

  return null;
}
