import { lazy } from 'react';

export const pages = {
  '/': lazy(() => import('../pages/HomePage')),
  '/voice-generation': lazy(() => import('../pages/VoiceGenerationPage')),
  '/clone-voice': lazy(() => import('../pages/CloneVoicePage')),
  '/settings': lazy(() => import('../pages/SettingsPage')),
};
