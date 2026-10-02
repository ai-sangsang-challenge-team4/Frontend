import { useMemo, useState, type ReactNode } from 'react';
import type { User } from '../../shared/types';
import { AuthContext } from './AuthContext';
import {
  createAuthUser,
  persistUser,
  readStoredUser,
  type LoginInput,
} from './authState';

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(() => readStoredUser());

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      login(input: LoginInput) {
        const nextUser = createAuthUser(input);
        setUser(nextUser);
        persistUser(nextUser);
        return nextUser;
      },
      logout() {
        setUser(null);
        persistUser(null);
      },
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
