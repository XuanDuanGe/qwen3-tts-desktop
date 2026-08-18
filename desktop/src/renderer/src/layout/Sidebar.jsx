import { useEffect } from 'react';
import { HiHome, HiMicrophone, HiOutlineCog6Tooth } from 'react-icons/hi2';
import { RiVoiceprintLine } from 'react-icons/ri';
import { NavLink } from 'react-router-dom';
import { track } from '../api/telemetry';
import { APP_ROUTE_ITEMS } from '../routes/config';

const ICONS = {
  '/': HiHome,
  '/voice-generate': HiMicrophone,
  '/voice-clone': RiVoiceprintLine,
  '/settings': HiOutlineCog6Tooth,
};

export default function Sidebar() {
  useEffect(() => {
    track('component_used', { component: 'sidebar' }, { once: true });
  }, []);

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span>QWEN TTS</span>
        <small>Desktop</small>
      </div>
      <nav className="sidebar__nav">
        {APP_ROUTE_ITEMS.map(({ path, label, end }) => {
          const Icon = ICONS[path];
          return (
            <NavLink
              key={path}
              to={path}
              end={end}
              className={({ isActive }) =>
                `sidebar__link${isActive ? ' sidebar__link--active' : ''}`
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
