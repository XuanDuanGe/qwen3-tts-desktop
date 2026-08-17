import { getCurrentWindow } from '@tauri-apps/api/window';
import { HiMiniMinus, HiOutlineSquare2Stack, HiXMark } from 'react-icons/hi2';

const appWindow = getCurrentWindow();

export default function TitleBar() {
  const handleMaximize = async () => {
    await appWindow.toggleMaximize();
  };

  return (
    <header
      className="flex h-10 shrink-0 select-none items-center border-b border-border bg-canvas"
      data-tauri-drag-region
    >
      <div className="flex flex-1 items-center gap-2 px-4" data-tauri-drag-region>
        <span className="h-4 w-4 rounded-ui border border-primary bg-primary-muted" />
        <span className="text-xs font-semibold tracking-wide text-text">
          Qwen3 TTS Desktop
        </span>
      </div>
      <div className="flex h-full" data-tauri-drag-region="false">
        <button
          aria-label="最小化窗口"
          className="flex w-12 items-center justify-center text-text-muted transition-colors hover:bg-elevated hover:text-text"
          onClick={() => appWindow.minimize()}
          type="button"
        >
          <HiMiniMinus className="h-4 w-4" />
        </button>
        <button
          aria-label="最大化窗口"
          className="flex w-12 items-center justify-center text-text-muted transition-colors hover:bg-elevated hover:text-text"
          onClick={handleMaximize}
          type="button"
        >
          <HiOutlineSquare2Stack className="h-3.5 w-3.5" />
        </button>
        <button
          aria-label="关闭窗口"
          className="flex w-12 items-center justify-center text-text-muted transition-colors hover:bg-danger hover:text-canvas"
          onClick={() => appWindow.close()}
          type="button"
        >
          <HiXMark className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
