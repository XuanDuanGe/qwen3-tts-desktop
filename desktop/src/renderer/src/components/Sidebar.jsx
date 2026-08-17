import { HiHome, HiMicrophone, HiOutlineCog6Tooth } from 'react-icons/hi2';
import { RiVoiceprintLine } from 'react-icons/ri';
import { NavLink } from 'react-router-dom';

const items = [
  { to: '/', label: '首页', icon: HiHome, end: true },
  { to: '/voice-generate', label: '语音生成', icon: HiMicrophone },
  { to: '/voice-clone', label: '语音克隆', icon: RiVoiceprintLine },
  { to: '/settings', label: '设置', icon: HiOutlineCog6Tooth },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span>QWEN TTS</span>
        <small>Desktop</small>
      </div>
      <nav className="sidebar__nav">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `sidebar__link${isActive ? ' sidebar__link--active' : ''}`
            }
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
