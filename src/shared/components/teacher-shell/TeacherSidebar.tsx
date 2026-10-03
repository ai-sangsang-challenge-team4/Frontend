import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import defaultProfileImage from '../../assets/profile.png';
import { Button } from '../ui/Button';
import {
  SidebarCollapseIcon,
  SidebarGuideIcon,
  SidebarMenuIcon,
  SidebarMessageIcon,
  SidebarSettingsIcon,
  SidebarShareIcon,
} from './icons';
import './TeacherSidebar.css';

export type SidebarItem = 'messages' | 'guide' | 'share' | 'settings';

type SidebarProps = {
  activeItem?: SidebarItem;
  defaultCollapsed?: boolean;
  messageCount?: number;
  onCollapsedChange?: (isCollapsed: boolean) => void;
  onLogout?: () => void;
  profileMeta?: string;
  profileName?: string;
};

const navItems = [
  {
    href: '/teacher/messages',
    icon: SidebarMessageIcon,
    key: 'messages',
    label: '메시지',
  },
  {
    href: '/teacher/guide',
    icon: SidebarGuideIcon,
    key: 'guide',
    label: '대응 가이드',
  },
  {
    href: '/teacher/admin-share',
    icon: SidebarShareIcon,
    key: 'share',
    label: '관리자 공유',
  },
] satisfies {
  href: string;
  icon: typeof SidebarMessageIcon;
  key: SidebarItem;
  label: string;
}[];

export function Sidebar({
  activeItem = 'messages',
  defaultCollapsed = true,
  messageCount = 0,
  onCollapsedChange,
  onLogout,
  profileMeta = 'teacher@example.com',
  profileName = '교사 사용자',
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const isSettingsActive = activeItem === 'settings';

  const handleToggleCollapsed = () => {
    const nextValue = !isCollapsed;

    setIsCollapsed(nextValue);
    onCollapsedChange?.(nextValue);
  };

  return (
    <aside
      className={`sidebar-shell${isCollapsed ? ' is-collapsed' : ''}`}
      aria-label="교사 메뉴"
    >
      <div className="sidebar-brand">
        <span className="sidebar-logo">(로고)</span>
        <strong>Teacher Hub</strong>
      </div>

      <button
        aria-label={isCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
        aria-pressed={isCollapsed}
        className="sidebar-collapse"
        onClick={handleToggleCollapsed}
        type="button"
      >
        {isCollapsed ? <SidebarMenuIcon /> : <SidebarCollapseIcon />}
      </button>

      <nav className="sidebar-nav" aria-label="주요 메뉴">
        {navItems.map(({ href, icon: Icon, key, label }) => {
          const isActive = activeItem === key;

          return (
            <NavLink
              aria-current={isActive ? 'page' : undefined}
              aria-label={label}
              className={`sidebar-link${isActive ? ' is-active' : ''}`}
              to={href}
              key={key}
              title={label}
            >
              <Icon className="sidebar-link-icon" />
              <span className="sidebar-link-label">{label}</span>
              {key === 'messages' && messageCount > 0 ? (
                <span className="sidebar-badge">{messageCount}</span>
              ) : null}
            </NavLink>
          );
        })}
      </nav>

      {onLogout ? (
        <Button
          className="sidebar-mobile-logout"
          leftIcon={<LogOut size={20} aria-hidden="true" />}
          onClick={onLogout}
          size="sm"
          variant="ghost"
        >
          로그아웃
        </Button>
      ) : null}

      <div className="sidebar-divider" aria-hidden="true" />

      <NavLink
        aria-current={isSettingsActive ? 'page' : undefined}
        aria-label="설정/도움말"
        className={`sidebar-utility-link${isSettingsActive ? ' is-active' : ''}`}
        to="/teacher/settings"
        title="설정/도움말"
      >
        <SidebarSettingsIcon className="sidebar-link-icon" />
        <span className="sidebar-link-label">설정/도움말</span>
      </NavLink>

      <div className="sidebar-profile">
        {isCollapsed && onLogout ? (
          <Button
            aria-label="로그아웃"
            className="sidebar-profile-logout"
            leftIcon={<LogOut size={20} aria-hidden="true" />}
            onClick={onLogout}
            size="sm"
            title="로그아웃"
            variant="ghost"
          />
        ) : (
          <img
            alt=""
            aria-hidden="true"
            className="sidebar-profile-avatar"
            src={defaultProfileImage}
          />
        )}
        <span className="sidebar-profile-copy">
          <strong>{profileName}</strong>
          <small>{profileMeta}</small>
          {onLogout ? (
            <button
              className="sidebar-logout-button"
              onClick={onLogout}
              type="button"
            >
              로그아웃
            </button>
          ) : null}
        </span>
      </div>
    </aside>
  );
}
