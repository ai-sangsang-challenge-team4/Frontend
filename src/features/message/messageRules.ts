import type {
  BadgeVariant,
  StatusChipStatus,
} from '../../shared/components/ui';
import type {
  BoardThread,
  FilterValue,
  RiskGuideAction,
  RiskLevel,
  SystemRiskLevel,
  ThreadStatus,
} from './types';

export const riskLabel: Record<RiskLevel, string> = {
  normal: '일반',
  attention: '주의',
  danger: '위험',
  urgent: '긴급',
};

export const riskVariant: Record<RiskLevel, BadgeVariant> = {
  normal: 'info',
  attention: 'warning',
  danger: 'danger',
  urgent: 'critical',
};

export const systemRiskTone: Record<SystemRiskLevel, RiskLevel> = {
  low: 'normal',
  medium: 'attention',
  high: 'danger',
  emergency: 'urgent',
};

export const systemRiskLabel: Record<SystemRiskLevel, string> = {
  low: '일반',
  medium: '주의',
  high: '위험',
  emergency: '긴급',
};

export const systemRiskReviewLevels: SystemRiskLevel[] = [
  'low',
  'medium',
  'high',
  'emergency',
];

export const threadRiskToSystemRisk: Record<RiskLevel, SystemRiskLevel> = {
  normal: 'low',
  attention: 'medium',
  danger: 'high',
  urgent: 'emergency',
};

export const shouldShowBufferedSummary: Record<RiskLevel, boolean> = {
  normal: false,
  attention: true,
  danger: true,
  urgent: true,
};

export const statusLabel: Record<ThreadStatus, string> = {
  before: '상담 전',
  inProgress: '상담 중',
  complete: '상담 완료',
};

export const statusChipStatus: Record<ThreadStatus, StatusChipStatus> = {
  before: 'pending',
  inProgress: 'progress',
  complete: 'complete',
};

export const filterOptions: { label: string; value: FilterValue }[] = [
  { label: '전체 상담', value: 'all' },
  { label: '진행 중 상담', value: 'active' },
  { label: '완료된 상담', value: 'complete' },
];

export const riskStageGuides: Record<
  SystemRiskLevel,
  {
    action?: RiskGuideAction;
    actionLabel?: string;
    description: string;
    headline: string;
    lockDescription: string;
    lockTitle: string;
    note?: string;
    procedureItems?: string[];
    procedureTitle?: string;
  }
> = {
  low: {
    headline: '‘일반’ 단계에서는 원문과 RAG 기반 답변 초안을 사용할 수 있습니다.',
    description:
      '원문 메시지와 관련 자료를 함께 확인하고 학교 규정에 맞게 답변을 작성해 주세요.',
    note: 'RAG 기반 AI 초안은 참고용이며, 최종 전송은 교사가 직접 결정합니다.',
    lockTitle: '답변 작성이 가능한 일반 대화입니다.',
    lockDescription: '필요한 확인을 마친 뒤 답변을 작성할 수 있습니다.',
  },
  medium: {
    headline: '‘주의’ 단계에서는 완충 요약과 원문 확인 후 답변을 진행합니다.',
    description:
      '위험 표현과 판단 이유를 먼저 확인하고 오해 가능성을 낮춘 문장으로 답변해 주세요.',
    note: 'AI 답변 초안은 사용할 수 있지만, 교사 검토 후 수정하는 것을 권고합니다.',
    lockTitle: '확인 후 답변이 권장되는 대화입니다.',
    lockDescription: '위험 표현과 판단 근거를 확인한 뒤 답변을 작성해 주세요.',
  },
  high: {
    action: 'procedure',
    actionLabel: '대응 절차 보기',
    headline: '‘위험’ 단계에서는 개별 AI 답변 초안이 제공되지 않습니다.',
    description:
      '완충 요약과 원문을 확인하고, 증빙 패키지와 승인된 공식 응답 템플릿 중심으로 대응해 주세요.',
    note: '증빙 보존과 관리자 공유 여부는 교사가 직접 선택합니다.',
    procedureTitle: '위험 단계 대응 순서',
    procedureItems: [
      '위험 표현과 판단 근거 확인',
      '필요 시 원문 열람 및 열람 기록 저장',
      '증빙 패키지 생성 여부 확인',
      '승인된 공식 템플릿으로 접수 확인 또는 절차 안내',
    ],
    lockTitle: '위험도가 높은 대화입니다.',
    lockDescription:
      '공식 템플릿과 증빙 보존 절차를 확인한 뒤 답변을 진행해 주세요.',
  },
  emergency: {
    action: 'procedure',
    actionLabel: '공식 절차 보기',
    headline: '‘긴급’ 단계에서는 답변 작성이 제한됩니다.',
    description:
      '완충 요약과 원문을 확인하고, 증빙 패키지를 보존한 뒤 즉시 오프라인 공식 절차에 따라 대응해 주세요.',
    note: '긴급 단계에서는 개별 답변 초안이 제공되지 않으며, 원문 열람 기록은 자동으로 저장됩니다.',
    procedureTitle: '긴급 단계 대응 순서',
    procedureItems: [
      '긴급 근거와 학생 안전 신호 확인',
      '필요 시 원문 열람 및 열람 기록 저장',
      '증빙 패키지 보존',
      '지정 담당자 검토 후 공식 대응 절차 진행',
    ],
    lockTitle: '‘긴급’ 단계에서는 답변 작성이 제한됩니다.',
    lockDescription:
      '위험도 검토가 끝난 뒤 공식 절차에 맞춰 답변을 진행할 수 있습니다.',
  },
};

export function getThreadRiskLevel(thread: BoardThread): SystemRiskLevel {
  return (
    thread.analysis?.teacherReviewedRiskLevel ??
    thread.analysis?.systemRiskLevel ??
    threadRiskToSystemRisk[thread.risk]
  );
}

export function canGenerateReplyDraft(thread: BoardThread) {
  const riskLevel = getThreadRiskLevel(thread);

  return riskLevel === 'low' || riskLevel === 'medium';
}

export function canUseOfficialReplyTemplate(thread: BoardThread) {
  return getThreadRiskLevel(thread) === 'high';
}

export function isReplyLocked(thread: BoardThread) {
  return getThreadRiskLevel(thread) === 'emergency';
}

export function getVisibleRiskFactors(thread: BoardThread) {
  return (
    thread.analysis?.riskFactors.filter(
      (factor) => factor.status !== 'unknown',
    ) ?? []
  );
}

export function getBufferedSummaryText(thread: BoardThread) {
  if (!shouldShowBufferedSummary[thread.risk]) {
    return undefined;
  }

  const analysisSummary =
    thread.analysis?.summary.status === 'ready'
      ? thread.analysis.summary.text
      : undefined;

  return thread.moderatedSummary ?? analysisSummary;
}

export function getPrimaryParentMessage(thread: BoardThread) {
  const parentReply = thread.replies.find(
    (reply) => reply.authorRole === 'parent',
  );

  if (
    thread.analysis?.canViewOriginal &&
    thread.analysis.originalMessageAvailable &&
    thread.originalMessage?.trim()
  ) {
    return thread.originalMessage.trim();
  }

  return parentReply?.content ?? thread.latestMessage;
}
