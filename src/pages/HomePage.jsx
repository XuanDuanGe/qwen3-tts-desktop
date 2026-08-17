import { useEffect } from 'react';
import { greet } from '../api/greetApi';
import { useAppStore } from '../store/appStore';

export default function HomePage() {
  const backendResult = useAppStore((state) => state.backendResult);
  const setBackendResult = useAppStore((state) => state.setBackendResult);

  useEffect(() => {
    greet('Qwen3 TTS').then(setBackendResult).catch(setBackendResult);
  }, [setBackendResult]);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl font-bold">HomePage</h1>
      <p className="mt-4 text-slate-700">{backendResult || '正在连接后端…'}</p>
    </main>
  );
}
