import { useEffect } from 'react';
import { HiHome, HiMicrophone, HiOutlineCog6Tooth } from 'react-icons/hi2';
import { RiFileMusicLine, RiVoiceprintLine } from 'react-icons/ri';
import { NavLink } from 'react-router-dom';
import { track } from '../api/telemetry';
import { APP_ROUTE_ITEMS } from '../routes/config';

const ICONS = {
  '/': HiHome,
  '/voice-generate': HiMicrophone,
  '/voice-clone': RiVoiceprintLine,
  '/audio-files': RiFileMusicLine,
  '/settings': HiOutlineCog6Tooth,
};

export default function Sidebar() {
  useEffect(() => {
    track('component_used', { component: 'sidebar' }, { once: true });
  }, []);

  return (
    <aside className="w-[208px] flex-none border-r border-border bg-canvas">
      <div className="flex flex-col gap-0.5 border-b border-border px-4 py-4 text-[13px] font-semibold text-text">
        <span>QWEN TTS</span>
        <small className="text-[11px] font-medium text-text-subtle">Desktop</small>
      </div>
      <nav className="grid gap-1.5 p-3">
        {APP_ROUTE_ITEMS.map(({ path, label, end }) => {
          const Icon = ICONS[path];
          return (
            <NavLink
              key={path}
              to={path}
              end={end}
              className={({ isActive }) =>
                `flex h-[38px] items-center gap-2.5 rounded-ui border px-2.5 text-sm no-underline transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                  isActive
                    ? 'border-primary-muted bg-primary-muted text-primary'
                    : 'border-transparent text-text-muted hover:border-border hover:bg-panel hover:text-text'
                }`
              }
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
