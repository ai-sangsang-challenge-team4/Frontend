import type { ReactNode } from 'react';
import { ApiErrorFallback } from './ApiErrorFallback';
import { LoadingState } from './LoadingState';

type AsyncContentProps = {
  children: ReactNode;
  error: unknown;
  homePath?: string;
  isLoading: boolean;
  loadingMessage?: string;
  onRetry?: () => void;
  variant?: 'page' | 'section';
};

export function AsyncContent({
  children,
  error,
  homePath,
  isLoading,
  loadingMessage,
  onRetry,
  variant = 'section',
}: AsyncContentProps) {
  if (isLoading) return <LoadingState message={loadingMessage} variant={variant} />;
  if (error) return <ApiErrorFallback error={error} homePath={homePath} onRetry={onRetry} variant={variant} />;
  return children;
}
