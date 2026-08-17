import { create } from 'zustand';

export const useAppStore = create((set) => ({
  backendResult: '',
  setBackendResult: (backendResult) => set({ backendResult }),
}));
