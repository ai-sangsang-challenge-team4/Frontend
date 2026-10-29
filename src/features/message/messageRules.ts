import type {
  BadgeVariant,
  StatusChipStatus,
} from '../../shared/components/ui';
import type {
  AiObjectionType,
  BoardThread,
  FilterValue,
  RiskFilterValue,
  RiskScore,
  SortValue,
  RiskGuideAction,
  RiskLevel,
  SystemRiskLevel,
  ThreadStatus,
} from './types';
import { getRiskClassifications } from '../risk-analysis';

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

// 'active' (before + inProgress) is the default so completed consultations stay hidden until the teacher asks for them.
export const filterOptions: { label: string; value: FilterValue }[] = [
  { label: '진행 중 상담', value: 'active' },
  { label: '완료된 상담', value: 'complete' },
  { label: '전체 상담', value: 'all' },
];

export const riskFilterOptions: { label: string; value: RiskFilterValue }[] = [
  { label: '전체', value: 'all' },
  ...systemRiskReviewLevels.map((level) => ({ label: systemRiskLabel[level], value: level })),
];

export const sortOptions: { label: string; value: SortValue }[] = [
  { label: '최신순', value: 'latest' },
  { label: '위험도 높은 순', value: 'risk' },
  { label: '상담 상태순', value: 'status' },
];

// GET /teacher/complaints sorts only by latest activity.
export const serverSortOptions: { label: string; value: SortValue }[] = [
  { label: '최신순', value: 'latest' },
  { label: '오래된순', value: 'oldest' },
];

export function matchesStatusFilter(status: ThreadStatus, filter: FilterValue) {
  if (filter === 'all') return true;
  return filter === 'active' ? status !== 'complete' : status === 'complete';
}

const statusSortOrder: Record<ThreadStatus, number> = { before: 0, inProgress: 1, complete: 2 };

export function compareThreads(left: BoardThread, right: BoardThread, sort: SortValue) {
  const byLatest = (Date.parse(right.latestAt) || 0) - (Date.parse(left.latestAt) || 0);
  if (sort === 'risk') {
    return systemRiskReviewLevels.indexOf(getThreadRiskLevel(right)) -
      systemRiskReviewLevels.indexOf(getThreadRiskLevel(left)) || byLatest;
  }
  if (sort === 'status') return statusSortOrder[left.status] - statusSortOrder[right.status] || byLatest;
  if (sort === 'oldest') return -byLatest;
  return byLatest;
}

export const riskScores: RiskScore[] = [1, 2, 3, 4, 5, 6, 7];

export const riskScoreGuides: Record<RiskScore, { example: string; label: string }> = {
  1: { label: '매우 안전', example: '감사 인사, 일상적인 안부처럼 대응 부담이 없는 메시지' },
  2: { label: '안전', example: '일정·준비물 확인 등 사실 확인만 필요한 단순 문의' },
  3: { label: '약간 주의', example: '불편함을 표현하지만 정중하고 요청이 분명한 메시지' },
  4: { label: '주의', example: '같은 요구를 반복하거나 감정적인 표현이 섞인 메시지' },
  5: { label: '위험', example: '교사 개인을 비난하거나 공격적인 표현이 담긴 메시지' },
  6: { label: '높은 위험', example: '민원·법적 조치를 언급하며 압박하거나 위협적인 표현이 있는 메시지' },
  7: { label: '매우 위험', example: '신체적 위협, 학생 안전 우려 등 즉시 대응이 필요한 메시지' },
};

export function riskScoreToLevel(score: RiskScore): SystemRiskLevel {
  if (score <= 2) return 'low';
  if (score <= 4) return 'medium';
  if (score <= 6) return 'high';
  return 'emergency';
}

// Starting score when the teacher has not rated yet: the lowest score inside the current level.
export const defaultRiskScore: Record<SystemRiskLevel, RiskScore> = { low: 1, medium: 3, high: 5, emergency: 7 };

export const aiObjectionTypeLabel: Record<AiObjectionType, string> = {
  overestimated: '실제보다 위험하게 판단했어요',
  underestimated: '실제보다 안전하게 판단했어요',
  wrongEvidence: '위험 요소나 판단 근거가 맞지 않아요',
  other: '기타',
};

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
      '지정 검토자가 잠금을 해제하기 전까지 답변 생성과 전송이 차단됩니다.',
  },
};

export function getThreadRiskLevel(thread: BoardThread): SystemRiskLevel {
  const reviewed = thread.analysis?.teacherReviewedRiskLevel;
  const system = thread.analysis?.systemRiskLevel;
  if (reviewed && systemRiskReviewLevels.includes(reviewed)) return reviewed;
  if (system && systemRiskReviewLevels.includes(system)) return system;
  return threadRiskToSystemRisk[thread.risk];
}

export function getAnalysisStatus(thread: BoardThread) {
  const analysis = thread.analysis;
  if (!analysis) return 'unavailable';
  if (analysis.status === 'loading' || analysis.status === 'failed') return analysis.status;
  if ((analysis.status !== undefined && analysis.status !== 'ready') ||
    !systemRiskReviewLevels.includes(analysis.systemRiskLevel) ||
    (analysis.teacherReviewedRiskLevel !== undefined && !systemRiskReviewLevels.includes(analysis.teacherReviewedRiskLevel)) ||
    !['NONE', 'POSSIBLE', 'URGENT_REVIEW'].includes(analysis.studentSafetySignal) ||
    !Array.isArray(analysis.riskFactors)) return 'failed';
  return 'ready';
}

// On a locked reply (emergency or safety lock), a teacher who can review the risk saves their own
// review first, then asks a reviewer to look again. Without a lock, saving the review already
// clears riskReviewRequired, so the request stays available as before.
export function needsTeacherReviewBeforeRequest(thread: BoardThread) {
  return Boolean(
    isReplyLocked(thread) && thread.analysis?.canReviewRisk && !thread.analysis.teacherReviewedRiskLevel,
  );
}

// safetyLock is set by the analysis and only a designated reviewer can lift it,
// so it blocks replies even after a teacher lowers the risk level.
export function isReplyLocked(thread: BoardThread) {
  const analysisStatus = getAnalysisStatus(thread);
  return getThreadRiskLevel(thread) === 'emergency' || Boolean(thread.analysis?.safetyLock) ||
    analysisStatus === 'loading' || analysisStatus === 'failed';
}

export function getReplyLockNotice(thread: BoardThread) {
  if (getThreadRiskLevel(thread) === 'emergency') return riskStageGuides.emergency;
  if (getAnalysisStatus(thread) === 'loading' || getAnalysisStatus(thread) === 'failed') {
    return {
      lockTitle: 'AI 분석 결과 확인이 필요합니다.',
      lockDescription: '분석 결과를 확인할 때까지 답변 생성과 전송이 제한됩니다. 필요한 경우 원문을 직접 확인해 주세요.',
    };
  }
  return {
    lockTitle: '안전 확인을 위해 답변 작성이 제한됩니다.',
    lockDescription: '위험도 수정이나 재검토 요청으로 안전 잠금이 해제되지 않습니다. 지정 검토자가 잠금을 해제하기 전까지 답변 생성과 전송이 차단됩니다.',
  };
}

export function canGenerateReplyDraft(thread: BoardThread) {
  const riskLevel = getThreadRiskLevel(thread);

  return (riskLevel === 'low' || riskLevel === 'medium') && !isReplyLocked(thread);
}

export function canUseOfficialReplyTemplate(thread: BoardThread) {
  return getThreadRiskLevel(thread) === 'high' && !isReplyLocked(thread);
}

export function getVisibleRiskFactors(thread: BoardThread) {
  if (getAnalysisStatus(thread) !== 'ready') return [];
  const factors = thread.analysis?.riskFactors.filter((factor) => factor.status !== 'unknown') ?? [];
  const classifications = getRiskClassifications(thread.analysis?.riskClassifications)
    .filter((result) => result.status === 'PRESENT' || result.status === 'BOUNDARY')
    .map((result) => ({
      id: result.code, name: result.label, description: result.label,
      evidence: result.evidenceSpan ?? '', rationale: result.rationale ?? '판단 이유가 제공되지 않았습니다.',
      status: result.status === 'PRESENT' ? 'detected' as const : 'boundary' as const,
    }));
  return [...factors, ...classifications.filter((result) =>
    !factors.some((factor) => factor.evidence && factor.evidence === result.evidence))];
}

export function getBufferedSummaryText(thread: BoardThread) {
  if (getThreadRiskLevel(thread) === 'low' ||
    (thread.analysis && getAnalysisStatus(thread) !== 'ready')) {
    return undefined;
  }

  if (thread.analysis) {
    return thread.analysis.summary?.status === 'ready'
      ? thread.analysis.summary.text?.trim() || undefined : undefined;
  }
  return thread.moderatedSummary?.trim() || undefined;
}

// A server thread's original comes from POST /original-views when opened, so it counts as available
// before it is loaded.
export function hasOriginalMessage(thread: BoardThread) {
  return Boolean(thread.originalMessage?.trim() || thread.serverComplaintId);
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
