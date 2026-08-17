import { useEffect } from 'react';
import { greet } from '../api/greet';
import useAppStore from '../store/appStore';

export default function HomePage() {
  const greeting = useAppStore((state) => state.greeting);
  const setGreeting = useAppStore((state) => state.setGreeting);

  useEffect(() => {
    greet('Qwen3 TTS').then(setGreeting);
  }, [setGreeting]);

  return (
    <main>
      <h1>HomePage</h1>
      <p>{greeting}</p>
    </main>
  );
}
