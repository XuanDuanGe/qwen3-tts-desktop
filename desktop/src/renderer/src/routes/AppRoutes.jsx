import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import MessageHost from '../app/MessageHost';
import TelemetryTracker from '../app/TelemetryTracker';
import HomePage from '../pages/HomePage';
import SettingsPage from '../pages/SettingsPage';
import VoiceClonePage from '../pages/VoiceClonePage';
import VoiceGeneratePage from '../features/voice-generate/VoiceGeneratePage';
import AudioFilesPage from '../pages/AudioFilesPage';
import Sidebar from '../layout/Sidebar';
import StatusBar from '../layout/StatusBar';
import TitleBar from '../layout/TitleBar';

export default function AppRoutes() {
  return (
    <HashRouter>
      <TelemetryTracker />
      <MessageHost />
      <div className="flex h-full flex-col bg-canvas">
        <TitleBar />
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <main className="app-scrollbar min-w-0 flex-1 overflow-y-auto bg-surface">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/voice-generate" element={<VoiceGeneratePage />} />
              <Route path="/voice-clone" element={<VoiceClonePage />} />
              <Route path="/audio-files" element={<AudioFilesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
        <StatusBar />
      </div>
    </HashRouter>
  );
}
