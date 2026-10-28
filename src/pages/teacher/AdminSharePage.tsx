import { AdminSharePanel } from '../../features/escalation';
import { TeacherAppLayout } from '../../shared/components';

export function AdminSharePage() {
  return (
    <TeacherAppLayout activeItem="share" showHeaderLogout={false} title="관리자 공유">
      <AdminSharePanel />
    </TeacherAppLayout>
  );
}

