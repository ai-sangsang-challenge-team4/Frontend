import { useEffect, useState } from 'react';
import { LogOut, Menu } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import defaultProfileImage from '../../assets/profile.png';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import {
  SidebarCollapseIcon,
  SidebarGuideIcon,
  SidebarMenuIcon,
  SidebarMessageIcon,
  SidebarSettingsIcon,
  SidebarShareIcon,
} from './icons';
import './TeacherSidebar.css';

export type SidebarItem = 'messages' | 'guide' | 'share' | 'settings' | 'new' | 'history';

type SidebarProps = {
  activeItem?: SidebarItem;
  defaultCollapsed?: boolean;
  messageCount?: number;
  onCollapsedChange?: (isCollapsed: boolean) => void;
  onLogout?: () => void;
  onAccountClick?: () => void;
  profileMeta?: string;
  profileName?: string;
  variant?: 'teacher' | 'parent';
};

type SidebarNavItem = {
  href: string;
  icon: typeof SidebarMessageIcon;
  key: SidebarItem;
  label: string;
};

const navItems: SidebarNavItem[] = [
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
];

const parentNavItems: SidebarNavItem[] = [
  { href: '/parent/messages/new', icon: SidebarMessageIcon, key: 'new', label: '새 문의' },
  { href: '/parent/messages', icon: SidebarGuideIcon, key: 'history', label: '문의 내역' },
];

export function Sidebar({
  activeItem = 'messages',
  defaultCollapsed = true,
  messageCount = 0,
  onCollapsedChange,
  onLogout,
  onAccountClick,
  profileMeta = 'teacher@example.com',
  profileName = '교사 사용자',
  variant = 'teacher',
}: SidebarProps) {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const isSettingsActive = activeItem === 'settings';
  const items = variant === 'parent' ? parentNavItems : navItems;
  const menuLabel = variant === 'parent' ? '학부모 메뉴' : '교사 메뉴';

  const handleToggleCollapsed = () => {
    const nextValue = !isCollapsed;

    setIsCollapsed(nextValue);
    onCollapsedChange?.(nextValue);
  };

  return (
    <aside
      className={`sidebar-shell${isCollapsed ? ' is-collapsed' : ''}`}
      aria-label={menuLabel}
    >
      <MobileSidebarMenu
        activeItem={activeItem}
        key={location.key}
        messageCount={messageCount}
        onLogout={onLogout}
        onAccountClick={onAccountClick}
        profileMeta={profileMeta}
        profileName={profileName}
        variant={variant}
      />
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
        {items.map(({ href, icon: Icon, key, label }) => {
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

      <div className="sidebar-divider" aria-hidden="true" />

      {variant === 'parent' ? (
        <button
          aria-label="설정/도움말"
          className="sidebar-utility-link"
          onClick={onAccountClick}
          title="설정/도움말"
          type="button"
        >
          <SidebarSettingsIcon className="sidebar-link-icon" />
          <span className="sidebar-link-label">설정/도움말</span>
        </button>
      ) : (
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
      )}

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

function MobileSidebarMenu({
  activeItem,
  messageCount,
  onLogout,
  onAccountClick,
  profileMeta,
  profileName,
  variant,
}: Pick<SidebarProps, 'activeItem' | 'messageCount' | 'onLogout' | 'onAccountClick' | 'profileMeta' | 'profileName' | 'variant'>) {
  const [isOpen, setIsOpen] = useState(false);
  const isParent = variant === 'parent';
  const menuLabel = isParent ? '학부모 메뉴' : '교사 메뉴';
  const mobileNavItems = isParent ? parentNavItems : [
    ...navItems,
    { href: '/teacher/settings', icon: SidebarSettingsIcon, key: 'settings', label: '설정/도움말' },
  ];

  useEffect(() => {
    const mobileViewport = window.matchMedia('(max-width: 980px)');
    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (!event.matches) setIsOpen(false);
    };

    mobileViewport.addEventListener('change', handleViewportChange);
    return () => mobileViewport.removeEventListener('change', handleViewportChange);
  }, []);

  const closeMenu = () => setIsOpen(false);
  const brand = (
    <NavLink className="sidebar-mobile-brand" onClick={closeMenu} to={isParent ? '/parent/messages/new' : '/teacher/messages'}>
      <span aria-hidden="true" className="sidebar-mobile-brand-mark">TH</span>
      Teacher Hub
    </NavLink>
  );

  return (
    <>
      <header className="sidebar-mobile-header">
        {brand}
        <button
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-label={`${menuLabel} 더보기`}
          className="sidebar-mobile-toggle"
          onClick={() => setIsOpen(true)}
          title={`${menuLabel} 더보기`}
          type="button"
        >
          <Menu aria-hidden="true" size={24} />
        </button>
      </header>
      <Modal
        className="teacher-mobile-menu"
        onOpenChange={setIsOpen}
        open={isOpen}
        title={<>{brand}<span className="sr-only">{menuLabel}</span></>}
      >
        <nav aria-label={`모바일 ${menuLabel}`} className="sidebar-mobile-nav">
          {mobileNavItems.map(({ href, icon: Icon, key, label }) => (
            <NavLink
              aria-current={activeItem === key ? 'page' : undefined}
              aria-label={label}
              className={`sidebar-mobile-link${activeItem === key ? ' is-active' : ''}`}
              key={key}
              onClick={closeMenu}
              to={href}
            >
              <Icon className="sidebar-link-icon" />
              <span>{label}</span>
              {key === 'messages' && (messageCount ?? 0) > 0 ? (
                <span className="sidebar-mobile-badge">{messageCount}</span>
              ) : null}
            </NavLink>
          ))}
          {isParent ? (
            <button
              className="sidebar-mobile-link"
              onClick={() => {
                closeMenu();
                onAccountClick?.();
              }}
              type="button"
            >
              <SidebarSettingsIcon className="sidebar-link-icon" />
              <span>설정/도움말</span>
            </button>
          ) : null}
        </nav>
        <div className="sidebar-mobile-account">
          <div className="sidebar-mobile-profile">
            <img alt="" src={defaultProfileImage} />
            <div>
              <strong>{profileName}</strong>
              <small>{profileMeta}</small>
            </div>
          </div>
          {onLogout ? (
            <Button
              className="sidebar-mobile-menu-logout"
              fullWidth
              leftIcon={<LogOut aria-hidden="true" size={20} />}
              onClick={() => {
                closeMenu();
                onLogout();
              }}
              variant="ghost"
            >
              로그아웃
            </Button>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
