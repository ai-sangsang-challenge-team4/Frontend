import { ArrowLeft, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import './ParentMessageComposer.css';

type ParentMessageHeaderProps = {
  title?: string;
  backLabel?: string;
  onBack?: () => void;
  showBack?: boolean;
  showBreadcrumb?: boolean;
  breadcrumbLabel?: string;
};

export function ParentMessageHeader({
  title = '새 문의 작성',
  backLabel = '문의 작성으로 돌아가기',
  onBack,
  showBack = true,
  showBreadcrumb = true,
  breadcrumbLabel = title,
}: ParentMessageHeaderProps) {
  const navigate = useNavigate();
  return (
    <header className="teacher-app-header parent-write-header">
      <div className="parent-write-heading">
        {showBack ? <button
          aria-label={backLabel}
          className="parent-write-back"
          onClick={onBack ?? (() => navigate('/parent/messages/new'))}
          title={backLabel}
          type="button"
        >
          <ArrowLeft aria-hidden="true" size={24} />
        </button> : null}
        <h1>{title}</h1>
      </div>
      {showBreadcrumb ? <nav aria-label="현재 위치" className="parent-write-breadcrumb">
        <Link to="/parent">홈</Link>
        <ChevronRight aria-hidden="true" size={20} />
        <span aria-current="page">{breadcrumbLabel}</span>
      </nav> : null}
    </header>
  );
}
