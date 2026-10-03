import {
  AdminShareList,
  type AdminShareRequest,
} from './components/AdminShareList';

const shareRequests: AdminShareRequest[] = [
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

export function AdminSharePanel() {
  return (
    <section className="page-section" aria-label="관리자 공유 현황">
      <AdminShareList requests={shareRequests} />
    </section>
  );
}
