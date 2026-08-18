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

  const controlClassName =
    'grid h-full w-[46px] place-items-center border-0 bg-transparent text-text-muted transition [-webkit-app-region:no-drag] hover:bg-elevated hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-2';

  return (
    <header className="flex h-9 flex-none select-none items-center justify-between border-b border-border bg-canvas text-text [-webkit-app-region:drag]">
      <div className="flex items-center gap-2 px-3 text-[13px] font-semibold">
        <span
          className="h-3.5 w-3.5 rounded border border-primary bg-primary-muted"
          aria-hidden="true"
        />
        <span>Qwen TTS Desktop</span>
      </div>
      <div className="flex h-full [-webkit-app-region:no-drag]">
        <button className={controlClassName} type="button" aria-label="最小化" onClick={minimizeWindow}>
          <FiMinus aria-hidden="true" />
        </button>
        <button
          className={controlClassName}
          type="button"
          aria-label={isMaximized ? '还原窗口' : '最大化'}
          onClick={handleToggleMaximize}
        >
          {isMaximized ? <FiMinimize2 aria-hidden="true" /> : <FiMaximize2 aria-hidden="true" />}
        </button>
        <button
          className={`${controlClassName} hover:bg-danger hover:text-canvas`}
          type="button"
          aria-label="关闭"
          onClick={closeWindow}
        >
          <FiX aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
