import { useNavigate } from 'react-router-dom';
import errorIllustration from '../../assets/error/api-error.png';
import { getApiErrorCopy, toApiError, type ApiErrorAction } from '../../api/apiError';
import { Button } from '../ui/Button';
import { classNames } from '../ui/classNames';
import './ApiFeedback.css';

type ApiErrorFallbackProps = {
  className?: string;
  error: unknown;
  // Role home such as /teacher; used by the 403/404 "홈으로" action.
  homePath?: string;
  // Re-runs the failed request. Without it, retry/refresh reload the page.
  onRetry?: () => void;
  variant?: 'page' | 'section';
};

export function ApiErrorFallback({ className, error, homePath = '/', onRetry, variant = 'page' }: ApiErrorFallbackProps) {
  const navigate = useNavigate();
  const apiError = toApiError(error);
  const copy = getApiErrorCopy(apiError);
  const statusLabel = apiError.status > 0 ? String(apiError.status) : null;

  const handlers: Record<ApiErrorAction, () => void> = {
    back: () => (window.history.length > 1 ? navigate(-1) : navigate(homePath)),
    login: () => navigate('/login', { replace: true }),
    home: () => navigate(homePath),
    refresh: () => (onRetry ? onRetry() : window.location.reload()),
    retry: () => (onRetry ? onRetry() : window.location.reload()),
  };

  return (
    <div className={classNames('api-feedback', `api-feedback--${variant}`, className)} role="alert">
      <img alt="" className="api-feedback-illustration" src={errorIllustration} />
      {statusLabel ? <p className="api-feedback-status">{statusLabel}</p> : null}
      <div className="api-feedback-copy">
        <h2>{copy.title}</h2>
        <p>{copy.description}</p>
      </div>
      <Button className="api-feedback-action" onClick={handlers[copy.action]}>
        {copy.actionLabel}
      </Button>
    </div>
  );
}
