import { createContext } from 'react';
import type { AuthContextValue } from './authState';

export const AuthContext = createContext<AuthContextValue | null>(null);
