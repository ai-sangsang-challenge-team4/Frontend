import { ChevronRight, Menu } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ButtonLink, Modal } from '../shared/components/ui';

export function PublicLayout() {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <div className="app-shell app-shell--public">
      <header className={`topbar${isHome ? ' topbar--home' : ''}`}>
        <PublicBrand />
        <nav className="topbar__nav" aria-label="공개 메뉴">
          <ButtonLink className="topbar__button" size="sm" to="/signup" variant="outline">
            회원가입
          </ButtonLink>
          <ButtonLink className="topbar__button" size="sm" to="/login">
            로그인
          </ButtonLink>
        </nav>
        <div className="topbar__mobile-actions">
          {isHome ? (
            <ButtonLink className="topbar__mobile-login" size="sm" to="/login">
              로그인
            </ButtonLink>
          ) : null}
          <PublicMobileMenu key={location.key} />
        </div>
      </header>
      <main className="app-shell__content">
        <Outlet />
      </main>
    </div>
  );
}

function PublicBrand({ onClick }: { onClick?: () => void }) {
  return (
    <NavLink className="brand" onClick={onClick} to="/">
      <span className="brand__mark" aria-hidden="true">
        TH
      </span>
      Teacher Hub
    </NavLink>
  );
}

function PublicMobileMenu() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const mobileViewport = window.matchMedia('(max-width: 760px)');
    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (!event.matches) setIsOpen(false);
    };

    mobileViewport.addEventListener('change', handleViewportChange);
    return () => mobileViewport.removeEventListener('change', handleViewportChange);
  }, []);

  const closeMenu = () => setIsOpen(false);

  return (
    <>
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label="메뉴 더보기"
        className="topbar__menu-toggle"
        onClick={() => setIsOpen(true)}
        title="메뉴 더보기"
        type="button"
      >
        <Menu aria-hidden="true" size={24} />
      </button>
      <Modal
        className="public-mobile-menu"
        onOpenChange={setIsOpen}
        open={isOpen}
        title={(
          <>
            <PublicBrand onClick={closeMenu} />
            <span className="sr-only">공개 메뉴</span>
          </>
        )}
      >
        <nav aria-label="모바일 공개 메뉴" className="public-mobile-menu__nav">
          <NavLink className="public-mobile-menu__link" onClick={closeMenu} to="/signup">
            회원가입
            <ChevronRight aria-hidden="true" size={20} />
          </NavLink>
          <NavLink className="public-mobile-menu__link" onClick={closeMenu} to="/login">
            로그인
            <ChevronRight aria-hidden="true" size={20} />
          </NavLink>
        </nav>
      </Modal>
    </>
  );
}
