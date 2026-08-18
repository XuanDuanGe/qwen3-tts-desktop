import { create } from 'zustand';
import {
  getEngineStatus,
  getModelCapabilities,
  installModel,
  listModels,
} from '../api/engine';

const useEngineStore = create((set) => ({
  status: 'unknown',
  models: [],
  error: null,
  initialize: async () => {
    try {
      const status = await getEngineStatus();
      set({ status, error: null });
      if (status !== 'ready') {
        return;
      }
      const result = await listModels();
      set({ models: result.models, error: null });
    } catch (error) {
      set({ status: 'unavailable', error: error.message });
    }
  },
  setStatus: (status) => set({ status }),
  setModels: (models) => set({ models }),
  getModelCapabilities: (modelId) => getModelCapabilities(modelId),
  installModel: async (modelId, proxy) => {
    const result = await installModel(modelId, proxy);
    const models = await listModels();
    set({ models: models.models || models });
    return result;
  },
}));

export default useEngineStore;
