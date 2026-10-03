import {
  StatusChip,
  type StatusChipStatus,
} from '../../../shared/components/ui';

export type AdminShareRequest = {
  owner: string;
  status: string;
  title: string;
};

const shareStatusVariant: Record<string, StatusChipStatus> = {
  '공유 대기': 'pending',
  '검토 중': 'review',
  '공유 완료': 'complete',
};

type AdminShareListProps = {
  requests: AdminShareRequest[];
};

export function AdminShareList({ requests }: AdminShareListProps) {
  return (
    <div className="status-list">
      {requests.map((request) => (
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
  );
}
