import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import TelemetryTracker from '../app/TelemetryTracker';
import HomePage from '../pages/HomePage';
import SettingsPage from '../pages/SettingsPage';
import VoiceClonePage from '../pages/VoiceClonePage';
import VoiceGeneratePage from '../features/voice-generate/VoiceGeneratePage';
import Sidebar from '../layout/Sidebar';
import TitleBar from '../layout/TitleBar';

export default function AppRoutes() {
  return (
    <HashRouter>
      <TelemetryTracker />
      <div className="app-shell">
        <TitleBar />
        <div className="app-shell__body">
          <Sidebar />
          <main className="app-shell__content">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/voice-generate" element={<VoiceGeneratePage />} />
              <Route path="/voice-clone" element={<VoiceClonePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </HashRouter>
  );
}
