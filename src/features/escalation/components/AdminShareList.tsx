import { Link } from 'react-router-dom';
import { StatusChip } from '../../../shared/components/ui';
import {
  escalationStatusChip,
  formatEscalationTime,
  teacherEscalationStatusLabel,
} from '../escalationRules';
import type { MockTeacherEscalation } from '../escalationTypes';
import './AdminShareList.css';

type AdminShareListProps = {
  escalations: MockTeacherEscalation[];
};

export function AdminShareList({ escalations }: AdminShareListProps) {
  return (
    <div className="status-list teacher-admin-share-list">
      {escalations.map((escalation) => (
        <article className="status-row" key={escalation.escalationId}>
          <div>
            <h2>
              <Link className="admin-share-row-link" to={`/teacher/messages/${escalation.complaintId}`}>
                {escalation.title}
              </Link>
            </h2>
            <p>{formatEscalationTime(escalation.sharedAt)} 공유</p>
          </div>
          <StatusChip
            label={teacherEscalationStatusLabel[escalation.escalationStatus]}
            status={escalationStatusChip[escalation.escalationStatus]}
          />
        </article>
      ))}
    </div>
  );
}
