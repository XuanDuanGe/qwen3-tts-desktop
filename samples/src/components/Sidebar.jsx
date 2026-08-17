import { HiHome, HiMicrophone, HiOutlineCog6Tooth } from 'react-icons/hi2';
import { RiVoiceprintLine } from 'react-icons/ri';
import { NavLink } from 'react-router-dom';

const navigationItems = [
  { to: '/', label: '主页', icon: HiHome, end: true },
  { to: '/voice-generation', label: '语音生成', icon: HiMicrophone },
  { to: '/clone-voice', label: '克隆语音', icon: RiVoiceprintLine },
  { to: '/settings', label: '设置', icon: HiOutlineCog6Tooth },
];

function Sidebar() {
  return (
    <aside className="flex w-52 shrink-0 flex-col border-r border-border bg-canvas px-3 py-4">
      <div className="border-b border-border px-2 pb-4">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-primary">
          ECHO FLOAT
        </p>
        <h1 className="mt-1 text-base font-semibold text-text">Desktop</h1>
      </div>
      <nav aria-label="主导航" className="mt-4 flex flex-col gap-1">
        {navigationItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-ui border px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-primary/50 bg-primary-muted text-primary'
                  : 'border-transparent text-text-muted hover:border-border hover:bg-panel hover:text-text'
              }`
            }
            end={end}
            key={to}
            to={to}
          >
            <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
