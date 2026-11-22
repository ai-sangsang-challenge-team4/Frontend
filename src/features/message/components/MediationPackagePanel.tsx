import { useRef, useState } from 'react';
import { getApiErrorMessage } from '../../../shared/api';
import { Accordion, Button, Modal } from '../../../shared/components/ui';
import { formatEscalationTime, historyEventLabel } from '../../escalation/escalationRules';
import type { HistoryEventType } from '../../../shared/types';
import { teacherInboxApi, type MediationPackageResponse } from '../api/teacherInboxApi';
import type { BoardThread } from '../types';

export function MediationPackagePanel({ thread, onCreate }: {
  thread: BoardThread;
  onCreate: (threadId: string, includeOriginalMessages?: boolean) => Promise<boolean>;
}) {
  const [includeOriginal, setIncludeOriginal] = useState(false);
  const [pending, setPending] = useState<'create' | 'view' | 'download' | null>(null);
  const pendingRef = useRef(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<MediationPackageResponse | null>(null);
  const saved = thread.mediationPackage;
  const canIncludeOriginal = Boolean(thread.analysis?.canViewOriginal && thread.analysis.originalMessageAvailable);
  const canReadSaved = !saved?.originalMessagesIncluded || canIncludeOriginal;

  const run = async (action: NonNullable<typeof pending>) => {
    if (pendingRef.current || thread.serverComplaintId === undefined) return;
    if (action === 'create' && !thread.analysis?.packageAvailable) return;
    if (action !== 'create' && !saved) return;
    if (action !== 'create' && !canReadSaved) return;
    pendingRef.current = true;
    setPending(action);
    setError('');
    try {
      if (action === 'create') {
        if (!await onCreate(thread.id, includeOriginal && canIncludeOriginal)) throw new Error('패키지를 생성할 수 없습니다.');
      } else if (action === 'view') {
        const result = await teacherInboxApi.getMediationPackage(thread.serverComplaintId, saved!.packageId);
        if (result.complaintId !== thread.serverComplaintId || result.packageId !== saved!.packageId) throw new Error('패키지 정보가 일치하지 않습니다.');
        setDetail(result);
      } else {
        // Keep the server's exact bytes (and therefore its checksum), with normal JWT/error handling.
        const blob = await teacherInboxApi.downloadMediationPackage(thread.serverComplaintId, saved!.packageId);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `mediation-package-${thread.serverComplaintId}-${saved!.packageId.replace(/[^\w-]/g, '')}.json`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (cause) {
      setError(getApiErrorMessage(cause, '패키지를 처리하지 못했습니다. 다시 시도해 주세요.'));
    } finally {
      pendingRef.current = false;
      setPending(null);
    }
  };

  return <section className="board-risk-workflow-panel board-mediation-panel" aria-label="증빙 패키지">
    <h2 className="board-risk-section-title">증빙 패키지</h2>
    <p>생성 시점의 메시지, 위험 분석과 처리 기록을 보관합니다. 기본적으로 개인정보가 가려진 내용만 포함합니다.</p>
    <label className="board-mediation-original">
      <input type="checkbox" checked={includeOriginal && canIncludeOriginal} disabled={Boolean(pending) || !canIncludeOriginal}
        onChange={(event) => setIncludeOriginal(event.target.checked)} />
      원문 메시지를 패키지에 포함합니다
    </label>
    {saved ? <p role="status">생성 시각: {formatEscalationTime(saved.createdAt)} · {saved.originalMessagesIncluded ? '원문 포함' : '원문 제외'}</p> : null}
    <div className="board-mediation-actions">
      <Button variant="outline" disabled={Boolean(pending) || !thread.analysis?.packageAvailable} onClick={() => void run('create')}>
        {pending === 'create' ? '생성 중…' : saved ? '새 패키지 생성' : '증빙 패키지 생성'}
      </Button>
      {saved ? <>
        <Button variant="outline" disabled={Boolean(pending && pending !== 'view') || !canReadSaved}
          aria-disabled={pending === 'view' || undefined} aria-busy={pending === 'view' || undefined}
          onClick={() => void run('view')}>{pending === 'view' ? '불러오는 중…' : '패키지 내용 보기'}</Button>
        <Button variant="outline" disabled={Boolean(pending) || !canReadSaved} onClick={() => void run('download')}>{pending === 'download' ? '다운로드 중…' : 'JSON 다운로드'}</Button>
      </> : null}
    </div>
    {error ? <p role="alert" className="board-admin-share-error">{error}</p> : null}
    <Modal open={Boolean(detail)} onOpenChange={(open) => { if (!open) setDetail(null); }} title="증빙 패키지 내용" size="lg"
      className="board-regulation-source-modal" description="생성 시점에 저장된 기록입니다. 이후 변경된 내용은 포함되지 않습니다."
      footer={<Button onClick={() => setDetail(null)}>닫기</Button>}>
      {detail ? <div className="board-regulation-source-content">
        <dl><div><dt>생성 시각</dt><dd>{formatEscalationTime(detail.createdAt)}</dd></div>
          <div><dt>원문</dt><dd>{detail.originalMessagesIncluded ? '포함' : '제외'}</dd></div></dl>
        <Accordion items={[
          { id: 'messages', title: `메시지 ${detail.content.messages.length}개`, content: detail.content.messages.map((message) => <section key={message.messageId}>
            <h3>{message.senderRole === 'TEACHER' ? '선생님 답변' : '학부모 메시지'} · {message.sentAt ? formatEscalationTime(message.sentAt) : ''}</h3>
            <p>{message.maskedContent || '표시할 내용이 없습니다.'}</p>
            {detail.originalMessagesIncluded && message.originalContent ? <><h3>원문</h3><p>{message.originalContent}</p></> : null}
          </section>) },
          { id: 'analyses', title: `위험 분석 ${detail.content.analyses.length}건`, content: detail.content.analyses.map((analysis) => <section key={analysis.analysisId}>
            <h3>{({ LOW: '일반', MEDIUM: '주의', HIGH: '높음', EMERGENCY: '긴급' } as Record<string, string>)[analysis.riskLevel] ?? '위험도 확인 필요'} · {analysis.riskScore}점</h3>
            {analysis.riskTags.map((tag) => <div key={tag.code}><h3>{tag.name}</h3><p>{tag.evidence}</p><p>{tag.reason}</p></div>)}
          </section>) },
          { id: 'history', title: '처리 기록', content: <>
            {!detail.content.responseHistory.logComplete ? <p role="status">일부 처리 기록이 누락되어 있습니다.</p> : null}
            {detail.content.responseHistory.missingLogs.map((log, index) => <p key={index}>{log.description}</p>)}
            {detail.content.responseHistory.events.map((event) => <p key={event.eventId}>{formatEscalationTime(event.occurredAt)} · {historyEventLabel[event.type as HistoryEventType] ?? '처리 기록'}{event.reason ? ` · ${event.reason}` : ''}</p>)}
          </> },
        ]} />
      </div> : null}
    </Modal>
  </section>;
}
