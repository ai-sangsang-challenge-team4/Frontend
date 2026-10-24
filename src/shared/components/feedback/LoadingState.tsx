import { LOADING_MESSAGES } from '../../api/apiError';
import { classNames } from '../ui/classNames';
import './ApiFeedback.css';

type LoadingStateProps = {
  className?: string;
  message?: string;
  variant?: 'page' | 'section';
};

export function LoadingState({ className, message = LOADING_MESSAGES.default, variant = 'section' }: LoadingStateProps) {
  return (
    <div
      aria-busy="true"
      className={classNames('api-feedback', `api-feedback--${variant}`, className)}
    >
      <span aria-hidden="true" className="api-feedback-spinner" />
      <p className="api-feedback-loading-text" role="status">{message}</p>
    </div>
  );
}
