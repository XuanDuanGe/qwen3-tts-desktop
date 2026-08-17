import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { pages } from './routeModules';

const HomePage = pages['/'];
const VoiceGenerationPage = pages['/voice-generation'];
const CloneVoicePage = pages['/clone-voice'];
const SettingsPage = pages['/settings'];

function PageFallback() {
  return (
    <div
      className="flex h-full items-center justify-center text-sm text-text-muted"
      role="status"
    >
      正在加载页面…
    </div>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<HomePage />} path="/" />
        <Route element={<VoiceGenerationPage />} path="/voice-generation" />
        <Route element={<CloneVoicePage />} path="/clone-voice" />
        <Route element={<SettingsPage />} path="/settings" />
        <Route element={<Navigate replace to="/" />} path="*" />
      </Routes>
    </Suspense>
  );
}

export default AppRoutes;
