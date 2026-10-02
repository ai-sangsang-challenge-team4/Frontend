import { NavLink, Outlet } from 'react-router-dom';

export function PublicLayout() {
  return (
    <div className="app-shell app-shell--public">
      <header className="topbar">
        <NavLink className="brand" to="/">
          Teacher Hub
        </NavLink>
        <nav className="topbar__nav" aria-label="공개 메뉴">
          <NavLink to="/login">로그인</NavLink>
          <NavLink to="/signup">회원가입</NavLink>
        </nav>
      </header>
      <main className="app-shell__content">
        <Outlet />
      </main>
    </div>
  );
}
