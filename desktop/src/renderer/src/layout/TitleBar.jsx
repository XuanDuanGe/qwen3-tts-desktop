import { useEffect, useState } from 'react';
import { FiMaximize2, FiMinimize2, FiMinus, FiX } from 'react-icons/fi';
import {
  closeWindow,
  isWindowMaximized,
  minimizeWindow,
  toggleMaximizeWindow,
} from '../api/windowControls';
import { track } from '../api/telemetry';

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    track('component_used', { component: 'title_bar' }, { once: true });
    isWindowMaximized()
      .then(setIsMaximized)
      .catch(() => undefined);
  }, []);

  async function handleToggleMaximize() {
    setIsMaximized(await toggleMaximizeWindow());
  }

  return (
    <header className="title-bar">
      <div className="title-bar__brand">
        <span className="title-bar__mark" aria-hidden="true" />
        <span>Qwen TTS Desktop</span>
      </div>
      <div className="title-bar__controls">
        <button type="button" aria-label="最小化" onClick={minimizeWindow}>
          <FiMinus aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={isMaximized ? '还原窗口' : '最大化'}
          onClick={handleToggleMaximize}
        >
          {isMaximized ? (
            <FiMinimize2 aria-hidden="true" />
          ) : (
            <FiMaximize2 aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          className="title-bar__close"
          aria-label="关闭"
          onClick={closeWindow}
        >
          <FiX aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
