import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from '../../layouts/AdminLayout';
import { ParentLayout } from '../../layouts/ParentLayout';
import { PublicLayout } from '../../layouts/PublicLayout';
import { TeacherLayout } from '../../layouts/TeacherLayout';
import { AdminHomePage } from '../../pages/admin/AdminHomePage';
import { SharedMessageDetailPage } from '../../pages/admin/SharedMessageDetailPage';
import { SharedMessageListPage } from '../../pages/admin/SharedMessageListPage';
import { LandingPage } from '../../pages/common/LandingPage';
import { LoginPage } from '../../pages/common/LoginPage';
import { NotFoundPage } from '../../pages/common/NotFoundPage';
import { SignupPage } from '../../pages/common/SignupPage';
import { MessageDetailPage as ParentMessageDetailPage } from '../../pages/parent/MessageDetailPage';
import { MessageHistoryPage } from '../../pages/parent/MessageHistoryPage';
import { MessageReviewPage } from '../../pages/parent/MessageReviewPage';
import { MessageWritePage } from '../../pages/parent/MessageWritePage';
import { ParentHomePage } from '../../pages/parent/ParentHomePage';
import { ExternalAnalysisPage } from '../../pages/teacher/ExternalAnalysisPage';
import { MessageDetailPage as TeacherMessageDetailPage } from '../../pages/teacher/MessageDetailPage';
import { MessageListPage } from '../../pages/teacher/MessageListPage';
import { ResponseWritePage } from '../../pages/teacher/ResponseWritePage';
import { TeacherHomePage } from '../../pages/teacher/TeacherHomePage';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleRoute } from './RoleRoute';

export function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="signup" element={<SignupPage />} />
      </Route>

      <Route
        path="parent"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={['PARENT']}>
              <ParentLayout />
            </RoleRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<ParentHomePage />} />
        <Route path="messages" element={<MessageHistoryPage />} />
        <Route path="messages/new" element={<MessageWritePage />} />
        <Route path="messages/:messageId/review" element={<MessageReviewPage />} />
        <Route path="messages/:messageId" element={<ParentMessageDetailPage />} />
        <Route path="*" element={<Navigate to="/parent" replace />} />
      </Route>

      <Route
        path="teacher"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={['TEACHER']}>
              <TeacherLayout />
            </RoleRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<TeacherHomePage />} />
        <Route path="messages" element={<MessageListPage />} />
        <Route path="messages/:messageId" element={<TeacherMessageDetailPage />} />
        <Route path="messages/:messageId/response" element={<ResponseWritePage />} />
        <Route path="external-analysis" element={<ExternalAnalysisPage />} />
        <Route path="*" element={<Navigate to="/teacher" replace />} />
      </Route>

      <Route
        path="admin"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={['ADMIN']}>
              <AdminLayout />
            </RoleRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminHomePage />} />
        <Route path="messages" element={<SharedMessageListPage />} />
        <Route path="messages/:messageId" element={<SharedMessageDetailPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
