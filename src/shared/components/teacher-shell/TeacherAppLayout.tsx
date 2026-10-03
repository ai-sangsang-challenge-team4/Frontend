import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../features/auth';
import { Header } from './TeacherHeader';
import { Sidebar, type SidebarItem } from './TeacherSidebar';

type AppLayoutProps = {
  activeItem: SidebarItem;
  children: ReactNode;
  headerActions?: ReactNode;
  title: string;
};

export function AppLayout({
  activeItem,
  children,
  headerActions,
  title,
}: AppLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div
      className={`app-layout${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}
    >
      <Sidebar
        activeItem={activeItem}
        defaultCollapsed={isSidebarCollapsed}
        messageCount={2}
        onCollapsedChange={setIsSidebarCollapsed}
        onLogout={handleLogout}
        profileMeta={user?.email}
        profileName={user?.name}
      />
      <div className="layout-body">
        <div className="content-shell">
          <Header
            actions={
              <>
                {headerActions}
                <button
                  className="teacher-logout-button"
                  onClick={handleLogout}
                  type="button"
                >
                  로그아웃
                </button>
              </>
            }
            title={title}
          />
          <main className="layout-main">{children}</main>
        </div>
      </div>
    </div>
  );
}
