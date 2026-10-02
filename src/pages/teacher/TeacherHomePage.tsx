import { Navigate } from 'react-router-dom';

export function TeacherHomePage() {
  return <Navigate to="/teacher/messages" replace />;
}
