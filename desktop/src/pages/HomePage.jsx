import { useEffect, useState } from 'react';
import { greet } from '../api/greet';
import useAppStore from '../store/appStore';

export default function HomePage() {
  const greetResult = useAppStore((state) => state.greetResult);
  const setGreetResult = useAppStore((state) => state.setGreetResult);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadGreeting() {
      try {
        const result = await greet('Qwen3 TTS');
        setGreetResult(result);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    }

    loadGreeting();
  }, [setGreetResult]);

  return (
    <main className="min-h-screen bg-[#101214] p-8 text-[#e6e9ec]">
      <h1 className="text-3xl font-semibold">HomePage</h1>
      {error ? (
        <p className="mt-4 text-red-400">{error}</p>
      ) : (
        <p className="mt-4">{greetResult}</p>
      )}
    </main>
  );
}
