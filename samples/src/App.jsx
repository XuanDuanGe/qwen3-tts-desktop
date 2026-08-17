import AppRoutes from './router/routes';
import Sidebar from './components/Sidebar';
import TitleBar from './components/TitleBar';

function App() {
  return (
    <main className="flex h-screen min-h-[600px] min-w-[800px] flex-col overflow-hidden bg-canvas text-text">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <div className="min-w-0 flex-1 overflow-y-auto bg-surface">
          <AppRoutes />
        </div>
      </div>
    </main>
  );
}

export default App;
