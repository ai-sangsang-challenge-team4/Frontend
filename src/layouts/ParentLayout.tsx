import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth';
import { Sidebar } from '../shared/components/teacher-shell/TeacherSidebar';
import '../shared/styles/teacher-prototype.css';
import './ParentLayout.css';

export function ParentLayout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isFollowUpPage = location.pathname.endsWith('/follow-up');
  const isDetailPage = /^\/parent\/messages\/[^/]+$/.test(location.pathname) && location.pathname !== '/parent/messages/new';
  // One sidebar state for every parent page so the page header does not shift between list and detail.
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const isHistoryPage = location.pathname === '/parent/messages' ||
    (location.pathname.startsWith('/parent/messages/') && location.pathname !== '/parent/messages/new');
  const activeItem = location.pathname === '/parent/mypage' ? 'mypage' : isHistoryPage ? 'history' : 'new';

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className={`app-layout parent-app-layout${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}${location.pathname === '/parent/messages' ? ' parent-history-layout' : ''}${isDetailPage ? ' parent-detail-layout' : ''}${isFollowUpPage ? ' parent-follow-up-layout' : ''}`}>
      <Sidebar
        activeItem={activeItem}
        defaultCollapsed={isSidebarCollapsed}
        onCollapsedChange={setIsSidebarCollapsed}
        onLogout={handleLogout}
        profileMeta={user?.email}
        profileName={user?.name}
        variant="parent"
      />
      <div className="layout-body">
        <div className="content-shell">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
