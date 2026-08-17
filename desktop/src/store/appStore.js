import { create } from 'zustand';

const useAppStore = create((set) => ({
  greetResult: '',
  setGreetResult: (greetResult) => set({ greetResult }),
}));

export default useAppStore;
