export type UserRole = 'PARENT' | 'TEACHER' | 'ADMIN';

export type User = {
  userId: number;
  name: string;
  email: string;
  role: UserRole;
};
