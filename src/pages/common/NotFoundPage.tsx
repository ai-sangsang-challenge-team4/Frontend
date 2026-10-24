import { getDefaultRolePath, useAuth } from '../../features/auth';
import { ApiError } from '../../shared/api';
import { ApiErrorFallback } from '../../shared/components';

const notFoundError = new ApiError({ status: 404 });

export function NotFoundPage() {
  const { user } = useAuth();

  return (
    <main>
      <ApiErrorFallback error={notFoundError} homePath={user ? getDefaultRolePath(user.role) : '/'} />
    </main>
  );
}
