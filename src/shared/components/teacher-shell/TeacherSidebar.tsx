import { useEffect, useState } from 'react';
import { LogOut, Menu } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import logoImage from '../../assets/logo.png';
import defaultProfileImage from '../../assets/profile.png';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import {
  SidebarCollapseIcon,
  SidebarGuideIcon,
  SidebarMenuIcon,
  SidebarMessageIcon,
  SidebarMyPageIcon,
  SidebarShareIcon,
} from './icons';
import './TeacherSidebar.css';

export type SidebarItem = 'messages' | 'guide' | 'share' | 'mypage' | 'new' | 'history' | 'adminMessages';

type SidebarProps = {
  activeItem?: SidebarItem;
  defaultCollapsed?: boolean;
  messageCount?: number;
  onCollapsedChange?: (isCollapsed: boolean) => void;
  onLogout?: () => void;
  profileMeta?: string;
  profileName?: string;
  variant?: 'teacher' | 'parent' | 'admin';
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

const adminNavItems: SidebarNavItem[] = [
  { href: '/admin/messages', icon: SidebarShareIcon, key: 'adminMessages', label: '공유받은 메시지' },
];

const sidebarVariants = {
  admin: { home: '/admin/messages', items: adminNavItems, label: '관리자 메뉴' },
  parent: { home: '/parent/messages/new', items: parentNavItems, label: '학부모 메뉴' },
  teacher: { home: '/teacher/messages', items: navItems, label: '교사 메뉴' },
} as const;

// The nav item that carries the unread/active count badge.
const badgeItems: SidebarItem[] = ['messages', 'adminMessages'];

export function Sidebar({
  activeItem = 'messages',
  defaultCollapsed = true,
  messageCount = 0,
  onCollapsedChange,
  onLogout,
  profileMeta = 'teacher@example.com',
  profileName = '교사 사용자',
  variant = 'teacher',
}: SidebarProps) {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const isMyPageActive = activeItem === 'mypage';
  const { items, label: menuLabel } = sidebarVariants[variant];

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
        profileMeta={profileMeta}
        profileName={profileName}
        variant={variant}
      />
      <div className="sidebar-brand">
        <img alt="" className="sidebar-logo" src={logoImage} />
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
              {badgeItems.includes(key) && messageCount > 0 ? (
                <span className="sidebar-badge">{messageCount}</span>
              ) : null}
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-divider" aria-hidden="true" />

      <NavLink
        aria-current={isMyPageActive ? 'page' : undefined}
        aria-label="마이페이지"
        className={`sidebar-utility-link${isMyPageActive ? ' is-active' : ''}`}
        to={`/${variant}/mypage`}
        title="마이페이지"
      >
        <SidebarMyPageIcon className="sidebar-link-icon" />
        <span className="sidebar-link-label">마이페이지</span>
      </NavLink>

      <div className="sidebar-profile">
        {isCollapsed && variant === 'parent' ? (
          <NavLink aria-label="마이페이지" className="sidebar-profile-account" to="/parent/mypage" title="마이페이지">
            <img alt="" aria-hidden="true" className="sidebar-profile-avatar" src={defaultProfileImage} />
          </NavLink>
        ) : isCollapsed && onLogout ? (
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
  profileMeta,
  profileName,
  variant,
}: Pick<SidebarProps, 'activeItem' | 'messageCount' | 'onLogout' | 'profileMeta' | 'profileName' | 'variant'>) {
  const [isOpen, setIsOpen] = useState(false);
  const { home: homePath, items: variantItems, label: menuLabel } = sidebarVariants[variant ?? 'teacher'];
  const mobileNavItems: SidebarNavItem[] = [
    ...variantItems,
    { href: `/${variant ?? 'teacher'}/mypage`, icon: SidebarMyPageIcon, key: 'mypage', label: '마이페이지' },
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
    <NavLink className="sidebar-mobile-brand" onClick={closeMenu} to={homePath}>
      <img alt="" className="sidebar-mobile-brand-mark" src={logoImage} />
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
              {badgeItems.includes(key) && (messageCount ?? 0) > 0 ? (
                <span className="sidebar-mobile-badge">{messageCount}</span>
              ) : null}
            </NavLink>
          ))}
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
