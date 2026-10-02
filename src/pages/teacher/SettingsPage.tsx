import { TeacherSettingsPanel } from '../../features/auth';
import { TeacherAppLayout } from '../../shared/components';

export function SettingsPage() {
  return (
    <TeacherAppLayout activeItem="settings" title="설정/도움말">
      <TeacherSettingsPanel />
    </TeacherAppLayout>
  );
}

