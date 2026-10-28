import { Link } from 'react-router-dom';
import { StatusChip } from '../../../shared/components/ui';
import {
  escalationStatusChip,
  formatEscalationTime,
  teacherEscalationStatusLabel,
} from '../escalationRules';
import type { ComplaintEscalation } from '../escalationTypes';
import './AdminShareList.css';

type AdminShareListProps = {
  escalations: ComplaintEscalation[];
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
            <p>
              {escalation.assignedAdminName} · {formatEscalationTime(escalation.sharedAt)} 공유
            </p>
            {escalation.adminMemo ? <p>관리자 메모: {escalation.adminMemo}</p> : null}
          </div>
          <StatusChip
            label={teacherEscalationStatusLabel[escalation.status]}
            status={escalationStatusChip[escalation.status]}
          />
        </article>
      ))}
    </div>
  );
}
