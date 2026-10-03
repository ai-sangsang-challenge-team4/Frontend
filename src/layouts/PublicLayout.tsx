import { NavLink, Outlet } from 'react-router-dom';
import { ButtonLink } from '../shared/components/ui';

export function PublicLayout() {
  return (
    <div className="app-shell app-shell--public">
      <header className="topbar">
        <NavLink className="brand" to="/">
          <span className="brand__mark" aria-hidden="true">
            TH
          </span>
          Teacher Hub
        </NavLink>
        <nav className="topbar__nav" aria-label="공개 메뉴">
          <ButtonLink className="topbar__button" size="sm" to="/signup" variant="outline">
            회원가입
          </ButtonLink>
          <ButtonLink className="topbar__button" size="sm" to="/login">
            로그인
          </ButtonLink>
        </nav>
      </header>
      <main className="app-shell__content">
        <Outlet />
      </main>
    </div>
  );
}
