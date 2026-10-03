export { TeacherSettingsPanel } from './TeacherSettingsPanel';
export { AuthProvider } from './AuthProvider';
export {
  getDefaultRolePath,
  ROLE_HOME_PATH,
  ROLE_LABEL,
  SIGNUP_ROLE_OPTIONS,
} from './authState';
export { useAuth } from './useAuth';
export { getAuthErrorMessage, isValidEmail } from './api/authApi';
export type { LoginInput, SignupInput, SignupRole } from './authState';
