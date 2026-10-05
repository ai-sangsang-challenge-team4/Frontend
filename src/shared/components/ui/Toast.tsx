import { CircleAlert, X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

type ToastProps = {
  message: string;
  onClose: () => void;
};

export function Toast({ message, onClose }: ToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 5_000);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);

  return createPortal(
    <div className="ui-toast">
      <CircleAlert aria-hidden="true" className="ui-toast-icon" size={20} />
      <p aria-atomic="true" role="alert">{message}</p>
      <button
        aria-label="알림 닫기"
        className="ui-toast-close"
        onClick={onClose}
        title="알림 닫기"
        type="button"
      >
        <X aria-hidden="true" size={20} />
      </button>
    </div>,
    document.body,
  );
}
