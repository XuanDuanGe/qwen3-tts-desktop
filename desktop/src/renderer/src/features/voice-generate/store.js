import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const DEFAULT_FORM = {
  modelId: '',
  capabilities: { speakers: [], languages: [] },
  text: '',
  instruct: '',
  speaker: '',
  language: 'Auto',
  splitByLine: false,
};

function normalizeForm(form) {
  const source = form && typeof form === 'object' ? form : {};
  return {
    modelId: typeof source.modelId === 'string' ? source.modelId : DEFAULT_FORM.modelId,
    capabilities:
      source.capabilities && typeof source.capabilities === 'object'
        ? {
            speakers: Array.isArray(source.capabilities.speakers)
              ? source.capabilities.speakers
              : DEFAULT_FORM.capabilities.speakers,
            languages: Array.isArray(source.capabilities.languages)
              ? source.capabilities.languages
              : DEFAULT_FORM.capabilities.languages,
          }
        : DEFAULT_FORM.capabilities,
    text: typeof source.text === 'string' ? source.text : DEFAULT_FORM.text,
    instruct:
      typeof source.instruct === 'string' ? source.instruct : DEFAULT_FORM.instruct,
    speaker: typeof source.speaker === 'string' ? source.speaker : DEFAULT_FORM.speaker,
    language:
      typeof source.language === 'string' ? source.language : DEFAULT_FORM.language,
    splitByLine:
      typeof source.splitByLine === 'boolean'
        ? source.splitByLine
        : DEFAULT_FORM.splitByLine,
  };
}

const useVoiceGenerateFormStore = create(
  persist(
    (set) => ({
      form: DEFAULT_FORM,
      setForm: (patch) =>
        set((state) => ({ form: { ...state.form, ...patch } })),
    }),
    {
      name: 'qwen3-tts:voice-generate-form:v1',
      partialize: (state) => ({ form: normalizeForm(state.form) }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...persistedState,
        form: normalizeForm(persistedState?.form),
      }),
    },
  ),
);

export default useVoiceGenerateFormStore;
