import { create } from 'zustand';
import {
  getEngineStatus,
  getModelCapabilities,
  installModel,
  listModels,
} from '../api/engine';

let initializationId = 0;

const useEngineStore = create((set) => ({
  status: 'unknown',
  models: [],
  error: null,
  initialize: async () => {
    const requestId = ++initializationId;
    try {
      const status = await getEngineStatus();
      if (requestId !== initializationId) return;
      set({ status, error: null });
      if (status !== 'ready') return;

      const result = await listModels();
      if (requestId === initializationId) {
        set({ models: result.models, error: null });
      }
    } catch (error) {
      if (requestId === initializationId) {
        set({ status: 'unavailable', error: error.message });
      }
    }
  },
  setStatus: (status) => {
    initializationId += 1;
    set({ status });
  },
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
