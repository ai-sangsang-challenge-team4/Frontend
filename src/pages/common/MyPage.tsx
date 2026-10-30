import { MyPagePanel, useAuth } from '../../features/auth';
import { TeacherAppLayout, TeacherHeader } from '../../shared/components';

export function MyPage() {
  const { user } = useAuth();

  if (user?.role === 'TEACHER') {
    return (
      <TeacherAppLayout activeItem="mypage" showHeaderLogout={false} title="마이페이지">
        <MyPagePanel />
      </TeacherAppLayout>
    );
  }

  return (
    <main className={user?.role === 'ADMIN' ? 'mypage-admin-main' : 'mypage-parent-main'}>
      <TeacherHeader title="마이페이지" />
      <div className="layout-main">
        <MyPagePanel />
      </div>
    </main>
  );
}
