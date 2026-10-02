import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth';

export function ParentLayout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="role-layout">
      <aside className="role-sidebar">
        <NavLink className="brand" to="/parent">
          Parent
        </NavLink>
        <nav className="role-nav" aria-label="학부모 메뉴">
          <NavLink to="/parent">홈</NavLink>
          <NavLink to="/parent/messages/new">메시지 작성</NavLink>
          <NavLink to="/parent/messages">메시지 이력</NavLink>
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
