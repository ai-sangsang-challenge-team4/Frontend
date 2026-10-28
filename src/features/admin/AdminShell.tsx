import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from '../../shared/components/teacher-shell/TeacherSidebar';
import { useAuth } from '../auth';
import { listAdminEscalations } from '../escalation/api';
import { useEscalationRequest } from '../escalation/useEscalationRequest';
import '../message/TeacherMessages.css';
import './AdminPages.css';

const loadPendingEscalations = (signal: AbortSignal) => listAdminEscalations({ status: 'SHARED' }, signal);

// Same shell as the teacher inbox: board layout with the shared sidebar.
export function AdminShell() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { data } = useEscalationRequest(loadPendingEscalations);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <section className={`board-inbox-page admin-inbox-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <Sidebar
        activeItem="adminMessages"
        defaultCollapsed={isSidebarCollapsed}
        messageCount={data?.length ?? 0}
        onCollapsedChange={setIsSidebarCollapsed}
        onLogout={handleLogout}
        profileMeta={user?.email}
        profileName={user?.name}
        variant="admin"
      />
      <Outlet />
    </section>
  );
}
