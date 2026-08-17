import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import TitleBar from '../components/TitleBar';
import HomePage from '../pages/HomePage';
import SettingsPage from '../pages/SettingsPage';
import VoiceClonePage from '../pages/VoiceClonePage';
import VoiceGeneratePage from '../pages/VoiceGeneratePage';

export default function AppRoutes() {
  return (
    <HashRouter>
      <TitleBar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/voice-generate" element={<VoiceGeneratePage />} />
        <Route path="/voice-clone" element={<VoiceClonePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
