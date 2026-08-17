import { create } from 'zustand';

const useAppStore = create((set) => ({
  greeting: '',
  setGreeting: (greeting) => set({ greeting }),
}));

export default useAppStore;
