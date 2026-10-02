import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth';

export function AdminLayout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

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
