import {
  StatusChip,
  type StatusChipStatus,
} from '../../shared/components/ui';

const shareRequests = [
  {
    title: '학부모 상담 일정 조율',
    owner: '생활지도부',
    status: '공유 대기',
  },
  {
    title: '위험 표현 포함 메시지',
    owner: '학년 부장',
    status: '검토 중',
  },
  {
    title: '현장체험학습 반복 문의',
    owner: '교무실',
    status: '공유 완료',
  },
];

const shareStatusVariant: Record<string, StatusChipStatus> = {
  '공유 대기': 'pending',
  '검토 중': 'review',
  '공유 완료': 'complete',
};

export function AdminSharePanel() {
  return (
    <section className="page-section" aria-label="관리자 공유 현황">
      <div className="status-list">
        {shareRequests.map((request) => (
          <article className="status-row" key={request.title}>
            <div>
              <h2>{request.title}</h2>
              <p>{request.owner}</p>
            </div>
            <StatusChip
              label={request.status}
              status={shareStatusVariant[request.status] ?? 'default'}
            />
          </article>
        ))}
      </div>
    </section>
  );
}
