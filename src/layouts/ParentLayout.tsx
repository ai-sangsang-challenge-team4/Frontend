import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth';
import { Sidebar } from '../shared/components/teacher-shell/TeacherSidebar';
import { Button, Modal } from '../shared/components/ui';
import '../shared/styles/teacher-prototype.css';
import './ParentLayout.css';

export function ParentLayout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isFollowUpPage = location.pathname.endsWith('/follow-up');
  const isDetailPage = /^\/parent\/messages\/[^/]+$/.test(location.pathname) && location.pathname !== '/parent/messages/new';
  const sidebarMode = isDetailPage || isFollowUpPage ? 'conversation' : 'default';
  const [sidebarPreferences, setSidebarPreferences] = useState({ default: false, conversation: true });
  const isSidebarCollapsed = sidebarPreferences[sidebarMode];
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const isHistoryPage = location.pathname === '/parent/messages' ||
    (location.pathname.startsWith('/parent/messages/') && location.pathname !== '/parent/messages/new');
  const activeItem = isHistoryPage ? 'history' : 'new';

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
        key={sidebarMode}
        activeItem={activeItem}
        defaultCollapsed={isSidebarCollapsed}
        onAccountClick={() => setIsAccountOpen(true)}
        onCollapsedChange={(collapsed) => setSidebarPreferences((previous) => ({ ...previous, [sidebarMode]: collapsed }))}
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
      <Modal
        footer={
          <Button leftIcon={<LogOut size={20} />} onClick={handleLogout} variant="outline">
            로그아웃
          </Button>
        }
        onOpenChange={setIsAccountOpen}
        open={isAccountOpen}
        title="계정 정보"
      >
        <p>{user?.name}</p>
        <p>{user?.email}</p>
      </Modal>
    </div>
  );
}
