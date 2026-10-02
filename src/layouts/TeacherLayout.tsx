import { NavLink, Outlet } from 'react-router-dom';

export function TeacherLayout() {
  return (
    <div className="role-layout">
      <aside className="role-sidebar">
        <NavLink className="brand" to="/teacher">
          Teacher
        </NavLink>
        <nav className="role-nav" aria-label="교사 메뉴">
          <NavLink to="/teacher">홈</NavLink>
          <NavLink to="/teacher/messages">메시지함</NavLink>
          <NavLink to="/teacher/external-analysis">외부 분석</NavLink>
        </nav>
      </aside>
      <main className="role-content">
        <Outlet />
      </main>
    </div>
  );
}
