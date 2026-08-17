import { getCurrentWindow } from '@tauri-apps/api/window';

const appWindow = getCurrentWindow();

function WindowButton({ label, onClick, danger = false, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`flex h-9 w-11 items-center justify-center text-sm text-[#cbd5e1] hover:bg-[#293139] ${
        danger ? 'hover:bg-[#c42b1c] hover:text-white' : ''
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function TitleBar() {
  async function toggleMaximize() {
    if (await appWindow.isMaximized()) {
      await appWindow.unmaximize();
    } else {
      await appWindow.maximize();
    }
  }

  return (
    <header className="flex h-9 shrink-0 select-none items-center border-b border-[#343a40] bg-[#101214] text-[#e6e9ec]">
      <span className="flex-1 truncate px-3 text-xs font-medium" data-tauri-drag-region>
        Qwen TTS Desktop
      </span>
      <div className="flex h-full">
        <WindowButton label="最小化" onClick={() => appWindow.minimize()}>
          ─
        </WindowButton>
        <WindowButton label="最大化或还原" onClick={toggleMaximize}>
          □
        </WindowButton>
        <WindowButton label="关闭" danger onClick={() => appWindow.close()}>
          ×
        </WindowButton>
      </div>
    </header>
  );
}
