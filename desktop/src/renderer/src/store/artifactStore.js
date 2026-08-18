import { create } from 'zustand';
import { deleteArtifact, getArtifact } from '../api/engine';

const useArtifactStore = create((set) => ({
  artifacts: {},
  get: async (artifactId) => {
    const artifact = await getArtifact(artifactId);
    set((state) => ({
      artifacts: { ...state.artifacts, [artifact.artifactId]: artifact },
    }));
    return artifact;
  },
  delete: async (artifactId) => {
    await deleteArtifact(artifactId);
    set((state) => {
      const artifacts = { ...state.artifacts };
      delete artifacts[artifactId];
      return { artifacts };
    });
  },
  add: (artifact) =>
    set((state) => ({
      artifacts: { ...state.artifacts, [artifact.artifactId]: artifact },
    })),
}));

export default useArtifactStore;
