import { Link } from 'react-router-dom';
import { StatusChip } from '../../../shared/components/ui';
import { RiskBadge } from '../../message/components/RiskBadge';
import {
  apiRiskTone,
  escalationStatusChip,
  formatEscalationTime,
  teacherEscalationStatusLabel,
} from '../escalationRules';
import type { TeacherEscalationSummaryResponse } from '../escalationTypes';
import '../../message/TeacherMessages.css';
import './AdminShareList.css';

type AdminShareListProps = {
  escalations: TeacherEscalationSummaryResponse[];
};

export function AdminShareList({ escalations }: AdminShareListProps) {
  return (
    <section className="board-thread-list teacher-admin-share-list" aria-label="관리자에게 공유한 메시지 목록">
      {escalations.map((escalation) => (
        <article className="board-thread-row teacher-admin-share-row" key={escalation.escalationId}>
          <Link
            className="board-thread-button teacher-admin-share-link"
            to={`/teacher/messages/${escalation.complaintId}`}
          >
            <span className="board-thread-copy">
              <span className="board-thread-title-row">
                <strong>{escalation.complaintTitle}</strong>
                <RiskBadge level={apiRiskTone[escalation.currentRiskLevel]} />
              </span>
              <span>
                {escalation.studentName ? `${escalation.studentName} 학생 · ` : ''}
                담당 관리자: {escalation.assignedAdminName}
              </span>
              <span className="teacher-admin-share-reason">공유 사유: {escalation.reason}</span>
            </span>
            <span className="board-thread-status">
              <StatusChip
                className="board-status-chip"
                label={teacherEscalationStatusLabel[escalation.escalationStatus]}
                status={escalationStatusChip[escalation.escalationStatus]}
              />
            </span>
            <time className="board-thread-time" dateTime={escalation.sharedAt}>
              {formatEscalationTime(escalation.sharedAt)} 공유
            </time>
          </Link>
        </article>
      ))}
    </section>
  );
}
