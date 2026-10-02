import { NavLink, Outlet } from 'react-router-dom';

export function ParentLayout() {
  return (
    <div className="role-layout">
      <aside className="role-sidebar">
        <NavLink className="brand" to="/parent">
          Parent
        </NavLink>
        <nav className="role-nav" aria-label="학부모 메뉴">
          <NavLink end to="/parent">
            홈
          </NavLink>
          <NavLink to="/parent/messages/new">메시지 작성</NavLink>
          <NavLink end to="/parent/messages">
            메시지 이력
          </NavLink>
        </nav>
      </aside>
      <main className="role-content">
        <Outlet />
      </main>
    </div>
  );
}
