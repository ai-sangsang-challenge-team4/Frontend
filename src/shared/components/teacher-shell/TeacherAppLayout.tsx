import { useState, type ReactNode } from 'react';
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

  return (
    <div
      className={`app-layout${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}
    >
      <Sidebar
        activeItem={activeItem}
        defaultCollapsed={isSidebarCollapsed}
        messageCount={2}
        onCollapsedChange={setIsSidebarCollapsed}
      />
      <div className="layout-body">
        <div className="content-shell">
          <Header actions={headerActions} title={title} />
          <main className="layout-main">{children}</main>
        </div>
      </div>
    </div>
  );
}
