import TitleBar from './components/TitleBar';
import AppRoutes from './routes/AppRoutes';

export default function App() {
  return (
    <main className="flex h-screen min-h-[600px] min-w-[900px] flex-col overflow-hidden bg-[#101214] text-[#e6e9ec]">
      <TitleBar />
      <div className="min-h-0 flex-1 overflow-auto">
        <AppRoutes />
      </div>
    </main>
  );
}
