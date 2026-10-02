import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth';

export function TeacherLayout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

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
        <div className="role-sidebar__footer">
          {user ? (
            <p className="role-user">
              <span>{user.name}</span>
              <span>{user.email}</span>
            </p>
          ) : null}
          <button className="text-button" onClick={handleLogout} type="button">
            로그아웃
          </button>
        </div>
      </aside>
      <main className="role-content">
        <Outlet />
      </main>
    </div>
  );
}
