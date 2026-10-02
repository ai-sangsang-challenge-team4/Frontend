import { NavLink, Outlet } from 'react-router-dom';

export function AdminLayout() {
  return (
    <div className="role-layout">
      <aside className="role-sidebar">
        <NavLink className="brand" to="/admin">
          Admin
        </NavLink>
        <nav className="role-nav" aria-label="관리자 메뉴">
          <NavLink end to="/admin">
            홈
          </NavLink>
          <NavLink to="/admin/messages">공유 메시지</NavLink>
        </nav>
      </aside>
      <main className="role-content">
        <Outlet />
      </main>
    </div>
  );
}
