import { create } from 'zustand';

const HIDE_DELAY = 3000;
const REMOVE_DELAY = 240;

const timers = new Map();

function clearMessageTimers(id) {
  const value = timers.get(id);
  if (!value) {
    return;
  }
  globalThis.clearTimeout(value.hideTimer);
  globalThis.clearTimeout(value.removeTimer);
  timers.delete(id);
}

const useMessageStore = create((set, get) => ({
  messages: [],
  push: ({ level = 'info', content }) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const message = { id, level, content, visible: true };
    set((state) => ({ messages: [...state.messages, message] }));
    const hideTimer = globalThis.setTimeout(() => {
      set((state) => ({
        messages: state.messages.map((item) =>
          item.id === id ? { ...item, visible: false } : item,
        ),
      }));
    }, HIDE_DELAY);
    const removeTimer = globalThis.setTimeout(() => {
      get().remove(id);
    }, HIDE_DELAY + REMOVE_DELAY);
    timers.set(id, { hideTimer, removeTimer });
    return id;
  },
  remove: (id) => {
    clearMessageTimers(id);
    set((state) => ({
      messages: state.messages.filter((item) => item.id !== id),
    }));
  },
}));

export default useMessageStore;
