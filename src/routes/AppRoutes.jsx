import { Navigate, Route, Routes } from 'react-router-dom';
import HomePage from '../pages/HomePage';
import SettingsPage from '../pages/SettingsPage';
import VoiceClonePage from '../pages/VoiceClonePage';
import VoiceGeneratePage from '../pages/VoiceGeneratePage';

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<HomePage />} path="/" />
      <Route element={<VoiceGeneratePage />} path="/voice-generate" />
      <Route element={<VoiceClonePage />} path="/voice-clone" />
      <Route element={<SettingsPage />} path="/settings" />
      <Route element={<Navigate replace to="/" />} path="*" />
    </Routes>
  );
}
