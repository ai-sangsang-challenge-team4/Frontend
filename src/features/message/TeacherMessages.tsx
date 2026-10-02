import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type SVGProps,
} from 'react';
import { Sidebar } from '../../shared/components/teacher-shell/TeacherSidebar';
import { SearchIcon, StarIcon } from '../../shared/components/teacher-shell/icons';
import {
  Accordion,
  Badge,
  Button,
  Dropdown,
  EmptyState,
  Modal,
  StatusChip,
  Tabs,
  TextField,
  type BadgeVariant,
  type StatusChipStatus,
} from '../../shared/components/ui';
import {
  emergencyOfficialProcedurePostId,
  replyReferenceGuidePostId,
} from '../safety/guidePostIds';
import defaultProfileImage from '../../shared/assets/profile.png';
import './TeacherMessages.css';

type ThreadStatus = 'before' | 'inProgress' | 'complete';
type RiskLevel = 'normal' | 'attention' | 'danger' | 'urgent';
type SystemRiskLevel = 'low' | 'medium' | 'high' | 'emergency';
type StudentSafetySignal = 'NONE' | 'POSSIBLE' | 'URGENT_REVIEW';
type RiskFactorStatus = 'detected' | 'boundary' | 'unknown';
type SummaryStatus = 'ready' | 'failed';
type ThreadTab = 'all' | 'starred' | 'drafts';
type DetailTab = 'conversation' | 'risk' | 'activity';
type FilterValue = 'all' | 'active' | 'complete';
type RiskGuideAction = 'original' | 'procedure';
type MessagesRouteView = 'detail' | 'reply';
type RiskFactorIconKind =
  | 'burden'
  | 'default'
  | 'official'
  | 'repeat'
  | 'safety';

type BufferedSummary = {
  status: SummaryStatus;
  text: string;
};

type RiskFactor = {
  description: string;
  evidence: string;
  id: string;
  name: string;
  rationale: string;
  status: RiskFactorStatus;
};

type ActivityLog = {
  action: string;
  actor: string;
  detail: string;
  id: string;
  time: string;
};

type ThreadAnalysis = {
  activityLogs: ActivityLog[];
  canReviewRisk: boolean;
  canViewActivityLog: boolean;
  canViewOriginal: boolean;
  originalMessageAvailable: boolean;
  packageAvailable: boolean;
  riskFactors: RiskFactor[];
  safetyLock: boolean;
  studentSafetySignal: StudentSafetySignal;
  summary: BufferedSummary;
  systemRiskLevel: SystemRiskLevel;
  teacherReviewReason?: string;
  teacherReviewedRiskLevel?: SystemRiskLevel;
};

type BoardReply = {
  authorName: string;
  authorRole: 'parent' | 'teacher';
  content: string;
  id: string;
  label: string;
  readByParent?: boolean;
  time: string;
};

type BoardThread = {
  analysis?: ThreadAnalysis;
  className: string;
  aiDraftGenerated?: boolean;
  draftSavedAt?: string;
  draftText: string;
  evidencePackageGenerated?: boolean;
  id: string;
  isPinned: boolean;
  latestAt: string;
  latestAtLabel: string;
  latestMessage: string;
  messageDateLabel?: string;
  moderatedSummary?: string;
  originalMessage?: string;
  officialTemplates?: string[];
  officialTemplateApplied?: boolean;
  parentName: string;
  replies: BoardReply[];
  risk: RiskLevel;
  riskReviewRequired: boolean;
  status: ThreadStatus;
  studentName: string;
  title: string;
};

type RiskReviewSubmission = {
  level: SystemRiskLevel;
  reason: string;
};

type TeacherMessagesProps = {
  initialThreadId?: string | null;
  initialView?: MessagesRouteView | null;
};

function getTeacherMessagePath(
  threadId?: string | null,
  view?: MessagesRouteView | null,
) {
  if (!threadId) {
    return '/teacher/messages';
  }

  const detailPath = `/teacher/messages/${encodeURIComponent(threadId)}`;

  return view === 'reply' ? `${detailPath}/response` : detailPath;
}

function pushTeacherMessageRoute(
  threadId?: string | null,
  view?: MessagesRouteView | null,
) {
  if (typeof window === 'undefined') {
    return;
  }

  window.history.pushState(null, '', getTeacherMessagePath(threadId, view));
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function getMessagesRouteStateFromLocation({
  initialThreadId,
  initialView,
}: TeacherMessagesProps): {
  threadId: string | null;
  view: MessagesRouteView | null;
} {
  if (initialThreadId) {
    return {
      threadId: initialThreadId,
      view: initialView === 'reply' ? 'reply' : 'detail',
    };
  }

  if (typeof window === 'undefined') {
    return { threadId: null, view: null };
  }

  const messagePathMatch = window.location.pathname.match(
    /^\/teacher\/messages\/([^/]+)(?:\/(response))?\/?$/,
  );

  if (messagePathMatch) {
    return {
      threadId: decodeURIComponent(messagePathMatch[1]),
      view: messagePathMatch[2] === 'response' ? 'reply' : 'detail',
    };
  }

  const hash = window.location.hash;
  const hashPath = hash.replace(/^#/, '').split('?')[0];

  if (!hash || !isMessagesHashPath(hashPath)) {
    return { threadId: null, view: null };
  }

  const queryStartIndex = hash.indexOf('?');

  if (queryStartIndex < 0) {
    return { threadId: null, view: null };
  }
  const params = new URLSearchParams(hash.slice(queryStartIndex + 1));
  const threadId = params.get('thread');

  if (!threadId) {
    return { threadId: null, view: null };
  }

  return {
    threadId,
    view: params.get('view') === 'reply' ? 'reply' : 'detail',
  };
}

function isMessagesHashPath(hashPath: string) {
  return !hashPath || hashPath === 'messages' || hashPath === '/messages';
}

function openGuidePostFromMessages(
  threadId: string,
  view: MessagesRouteView,
  postId: string,
) {
  if (typeof window === 'undefined') {
    return;
  }

  window.history.replaceState(
    null,
    '',
    getTeacherMessagePath(threadId, view),
  );
  window.history.pushState(
    {
      ...(typeof window.history.state === 'object' &&
      window.history.state !== null
        ? window.history.state
        : {}),
      showGuideBackButton: true,
    },
    '',
    `/teacher/guide?post=${encodeURIComponent(postId)}`,
  );
  window.dispatchEvent(new PopStateEvent('popstate'));
}

const initialThreads: BoardThread[] = [
  {
    id: 'thread-001',
    parentName: '최유진 학부모',
    studentName: '최유진',
    className: '3학년 2반',
    title: '상담 일정 및 조치 내용 확인 요청',
    latestMessage: '학부모 상담 가능 일정을 확인하고 조율을 요청',
    latestAt: '2026-08-03T10:24:00+09:00',
    latestAtLabel: '2026.08.03 오전 10:24',
    risk: 'urgent',
    status: 'before',
    riskReviewRequired: true,
    draftText: '',
    isPinned: false,
    messageDateLabel: '2026년 8월 10일 월요일',
    moderatedSummary: '상담 일정을 요구하며 불만과 압박을 표현하고 있음.',
    originalMessage:
      '오늘 중으로 꼭 연락 주세요. 아이가 학교에 가기 싫다고 하고 집에서도 계속 울어서 저도 너무 불안합니다. 그냥 상담 일정만 잡는 말로 끝내지 말고, 학교에서 지금까지 무엇을 확인했고 어떤 조치를 했는지 분명히 알려 주세요. 답이 늦으면 더 이상 기다리기 어렵습니다.',
    officialTemplates: [
      '학급 생활 관찰 기록 양식',
      '상담 일정 조율 안내문',
      '학생 안전 확인 체크리스트',
    ],
    analysis: {
      systemRiskLevel: 'emergency',
      teacherReviewedRiskLevel: undefined,
      safetyLock: true,
      studentSafetySignal: 'POSSIBLE',
      canViewOriginal: true,
      originalMessageAvailable: true,
      canReviewRisk: true,
      canViewActivityLog: true,
      packageAvailable: true,
      summary: {
        status: 'ready',
        text: '상담 일정을 요구하며 불만과 압박을 표현하고 있음.',
      },
      riskFactors: [
        {
          id: 'factor-pressure',
          name: '즉시 응답 압박',
          description: '오늘 중 연락과 조치 설명을 강하게 요청하고 있습니다.',
          status: 'detected',
          rationale:
            '답변 기한을 특정하고 후속 행동을 예고해 교사가 즉시 대응해야 하는 압박으로 해석될 수 있습니다.',
          evidence: '오늘 중으로 꼭 연락 주세요',
        },
        {
          id: 'factor-student-safety',
          name: '학생 안전 신호',
          description:
            '학생이 등교를 거부하고 울었다는 표현이 있어 별도 확인이 필요합니다.',
          status: 'boundary',
          rationale:
            '직접적인 위해 표현은 아니지만 학생의 정서 상태를 확인해야 하는 경계 신호입니다.',
          evidence: '학교에 가기 싫다고 하고 집에서도 계속 울어서',
        },
        {
          id: 'factor-accountability',
          name: '조치 설명 요구',
          description:
            '상담 일정뿐 아니라 학교의 확인 내용과 대응 조치를 요구합니다.',
          status: 'detected',
          rationale:
            '교사가 답변 전 사실 확인과 내부 기록 점검을 함께 해야 하는 요청입니다.',
          evidence: '무엇을 확인했고 어떤 조치를 했는지',
        },
      ],
      activityLogs: [
        {
          id: 'log-001',
          time: '2026.08.23 오전 10:24',
          actor: 'AI 분석',
          action: '위험도 산정',
          detail: '시스템 위험도를 긴급으로 분류했습니다.',
        },
        {
          id: 'log-002',
          time: '2026.08.23 오전 10:25',
          actor: '조예인 선생님',
          action: '상세 화면 진입',
          detail: '완충 요약과 위험 요소를 확인했습니다.',
        },
      ],
    },
    replies: [
      {
        id: 'reply-001-1',
        authorName: '최유진 학부모',
        authorRole: 'parent',
        label: '게시글',
        time: '오전 10:11',
        content:
          '네, 오늘 중으로 꼭 연락 부탁드립니다. 아이가 요즘 학교에 가기 싫다고 할 정도라 저도 많이 걱정됩니다. 단순히 상담 일정만 잡는 것보다 학교에서 지금까지 어떤 상황을 확인했고 어떻게 대응하고 있는지도 같이 설명해 주셨으면 합니다.',
      }
    ],
  },
  {
    id: 'thread-002',
    parentName: '박서준 학부모',
    studentName: '박서준',
    className: '4학년 1반',
    title: '친구와의 갈등 후속 확인',
    latestMessage:
      '어제 쉬는 시간 일을 아이가 계속 이야기해서 후속 확인을 부탁드립니다.',
    latestAt: '2026-08-23T09:08:00+09:00',
    latestAtLabel: '2026.08.23 오전 9:08',
    risk: 'attention',
    status: 'inProgress',
    riskReviewRequired: false,
    draftText:
      '안녕하세요, 학부모님. 말씀해 주신 상황을 확인한 뒤 오늘 하교 전까지 안내드리겠습니다.',
    isPinned: false,
    messageDateLabel: '2026년 8월 23일 일요일',
    moderatedSummary: '친구와의 갈등 이후 학생 정서 확인과 후속 안내를 요청함.',
    originalMessage:
      '어제 쉬는 시간에 있었던 일 때문에 아이가 계속 속상해합니다. 상대 학생과 어떤 대화가 있었는지 확인 부탁드립니다.',
    analysis: {
      systemRiskLevel: 'medium',
      safetyLock: false,
      studentSafetySignal: 'NONE',
      canViewOriginal: true,
      originalMessageAvailable: true,
      canReviewRisk: true,
      canViewActivityLog: true,
      packageAvailable: false,
      summary: {
        status: 'ready',
        text: '친구와의 갈등 이후 학생 정서 확인과 후속 안내를 요청함.',
      },
      riskFactors: [
        {
          id: 'factor-peer-conflict',
          name: '또래 갈등',
          description: '쉬는 시간 갈등과 학생의 속상함이 언급되었습니다.',
          status: 'detected',
          rationale: '상대 학생과의 대화 확인이 필요한 생활지도 맥락입니다.',
          evidence: '상대 학생과 어떤 대화가 있었는지',
        },
      ],
      activityLogs: [
        {
          id: 'log-002-1',
          time: '2026.08.23 오전 9:08',
          actor: '조예인 선생님',
          action: '답변 초안 저장',
          detail: '학부모 안내 초안을 임시저장했습니다.',
        },
      ],
    },
    replies: [
      {
        id: 'reply-002-1',
        authorName: '박서준 학부모',
        authorRole: 'parent',
        label: '게시글',
        time: '오전 8:42',
        content:
          '어제 쉬는 시간에 있었던 일 때문에 아이가 계속 속상해합니다. 상대 학생과 어떤 대화가 있었는지 확인 부탁드립니다.',
      },
      {
        id: 'reply-002-2',
        authorName: '조예인 선생님',
        authorRole: 'teacher',
        label: '선생님 답변',
        readByParent: false,
        time: '오전 9:01',
        content:
          '말씀해 주신 내용을 확인했습니다. 아이가 느낀 부분을 먼저 살피고, 관련 학생들과 상황을 차분히 확인하겠습니다.',
      },
    ],
  },
  {
    id: 'thread-003',
    parentName: '정하준 학부모',
    studentName: '정하준',
    className: '3학년 2반',
    title: '현장체험학습 준비물 문의',
    latestMessage:
      '안내장 준비물 외에 개인 도시락을 챙겨도 되는지 궁금합니다.',
    latestAt: '2026-08-22T17:20:00+09:00',
    latestAtLabel: '2026.08.22 오후 5:20',
    risk: 'normal',
    status: 'before',
    riskReviewRequired: false,
    draftText: '',
    isPinned: false,
    messageDateLabel: '2026년 8월 22일 토요일',
    originalMessage: '',
    analysis: {
      systemRiskLevel: 'low',
      safetyLock: false,
      studentSafetySignal: 'NONE',
      canViewOriginal: false,
      originalMessageAvailable: false,
      canReviewRisk: false,
      canViewActivityLog: true,
      packageAvailable: false,
      summary: {
        status: 'failed',
        text: '요약을 불러오지 못했습니다.',
      },
      riskFactors: [
        {
          id: 'factor-general-inquiry',
          name: '일반 문의',
          description: '준비물과 일정에 관한 확인 요청입니다.',
          status: 'unknown',
          rationale:
            '원문 권한이 없어 AI 근거를 표시하지 못하지만 목록 위험도는 일반으로 유지됩니다.',
          evidence: '원문 확인 권한 없음',
        },
      ],
      activityLogs: [
        {
          id: 'log-003-1',
          time: '2026.08.22 오후 5:20',
          actor: '시스템',
          action: '메시지 수신',
          detail: '일반 문의로 분류되었습니다.',
        },
      ],
    },
    replies: [
      {
        id: 'reply-003-1',
        authorName: '정하준 학부모',
        authorRole: 'parent',
        label: '게시글',
        time: '오후 5:20',
        content:
          '안내장에 적힌 준비물 외에 개인 도시락을 챙겨도 되는지 궁금합니다. 물은 어느 정도 가져가면 될까요?',
      },
    ],
  },
  {
    id: 'thread-004',
    parentName: '이수아 학부모',
    studentName: '이수아',
    className: '5학년 3반',
    title: '가정 내 변화에 따른 학교 생활 확인',
    latestMessage:
      '최근 가정 상황이 바뀌어 아이가 예민할 수 있어 생활 확인을 부탁드립니다.',
    latestAt: '2026-08-22T14:06:00+09:00',
    latestAtLabel: '2026.08.22 오후 2:06',
    risk: 'danger',
    status: 'inProgress',
    riskReviewRequired: false,
    draftText: '',
    isPinned: false,
    messageDateLabel: '2026년 8월 22일 토요일',
    moderatedSummary: '학생 정서 변화 가능성이 있어 생활 관찰과 기록이 필요함.',
    originalMessage:
      '최근 가정 상황이 바뀌어 아이가 예민할 수 있습니다. 학교에서 달라진 모습이 있는지 확인해 주시면 감사하겠습니다.',
    officialTemplates: ['생활 관찰 기록', '상담 연계 안내', '가정-학교 협력 메모'],
    analysis: {
      systemRiskLevel: 'high',
      safetyLock: false,
      studentSafetySignal: 'POSSIBLE',
      canViewOriginal: true,
      originalMessageAvailable: true,
      canReviewRisk: true,
      canViewActivityLog: true,
      packageAvailable: true,
      summary: {
        status: 'ready',
        text: '학생 정서 변화 가능성이 있어 생활 관찰과 기록이 필요함.',
      },
      riskFactors: [
        {
          id: 'factor-home-change',
          name: '가정 내 변화',
          description: '가정 상황 변화가 학생 생활에 영향을 줄 수 있습니다.',
          status: 'boundary',
          rationale:
            '직접 위험 단정은 어렵지만 학교 생활 관찰과 기록을 남기는 것이 적절합니다.',
          evidence: '최근 가정 상황이 바뀌어',
        },
      ],
      activityLogs: [
        {
          id: 'log-004-1',
          time: '2026.08.22 오후 2:06',
          actor: 'AI 분석',
          action: '위험 요소 요약',
          detail: '가정 변화와 학생 정서 관찰 필요성을 표시했습니다.',
        },
      ],
    },
    replies: [
      {
        id: 'reply-004-1',
        authorName: '이수아 학부모',
        authorRole: 'parent',
        label: '게시글',
        time: '오후 2:06',
        content:
          '최근 가정 상황이 바뀌어 아이가 예민할 수 있습니다. 학교에서 달라진 모습이 있는지 확인해 주시면 감사하겠습니다.',
      },
    ],
  },
  {
    id: 'thread-005',
    parentName: '최도윤 학부모',
    studentName: '최도윤',
    className: '2학년 4반',
    title: '방과후 수업 결석 처리 확인',
    latestMessage:
      '지난 금요일 방과후 수업 결석이 출결에 어떻게 반영되는지 확인했습니다.',
    latestAt: '2026-08-21T16:48:00+09:00',
    latestAtLabel: '2026.08.21 오후 4:48',
    risk: 'normal',
    status: 'complete',
    riskReviewRequired: false,
    draftText: '',
    isPinned: false,
    replies: [
      {
        id: 'reply-005-1',
        authorName: '최도윤 학부모',
        authorRole: 'parent',
        label: '게시글',
        time: '오후 4:12',
        content:
          '지난 금요일 방과후 수업 결석이 출결에 어떻게 반영되는지 확인 부탁드립니다.',
      },
      {
        id: 'reply-005-2',
        authorName: '조예인 선생님',
        authorRole: 'teacher',
        label: '선생님 답변',
        readByParent: true,
        time: '오후 4:48',
        content:
          '방과후 수업 결석은 정규 수업 출결과 별도로 기록됩니다. 자세한 내용은 방과후 담당 선생님께도 공유해 두었습니다.',
      },
    ],
  },
];

const riskLabel: Record<RiskLevel, string> = {
  normal: '일반',
  attention: '주의',
  danger: '위험',
  urgent: '긴급',
};

const riskVariant: Record<RiskLevel, BadgeVariant> = {
  normal: 'info',
  attention: 'warning',
  danger: 'danger',
  urgent: 'critical',
};

const systemRiskTone: Record<SystemRiskLevel, RiskLevel> = {
  low: 'normal',
  medium: 'attention',
  high: 'danger',
  emergency: 'urgent',
};

const systemRiskLabel: Record<SystemRiskLevel, string> = {
  low: '일반',
  medium: '주의',
  high: '위험',
  emergency: '긴급',
};

const systemRiskReviewLevels: SystemRiskLevel[] = [
  'low',
  'medium',
  'high',
  'emergency',
];

const threadRiskToSystemRisk: Record<RiskLevel, SystemRiskLevel> = {
  normal: 'low',
  attention: 'medium',
  danger: 'high',
  urgent: 'emergency',
};

const shouldShowBufferedSummary: Record<RiskLevel, boolean> = {
  normal: false,
  attention: true,
  danger: true,
  urgent: true,
};

const statusLabel: Record<ThreadStatus, string> = {
  before: '상담 전',
  inProgress: '상담 중',
  complete: '상담 완료',
};

const statusChipStatus: Record<ThreadStatus, StatusChipStatus> = {
  before: 'pending',
  inProgress: 'progress',
  complete: 'complete',
};

const filterOptions: { label: string; value: FilterValue }[] = [
  { label: '전체 상담', value: 'all' },
  { label: '진행 중 상담', value: 'active' },
  { label: '완료된 상담', value: 'complete' },
];

const detailTabLabel: Record<DetailTab, string> = {
  conversation: '대화',
  risk: '위험 요소',
  activity: '처리 기록',
};

const detailTabs: DetailTab[] = ['conversation', 'risk', 'activity'];

function getThreadRiskLevel(thread: BoardThread): SystemRiskLevel {
  return (
    thread.analysis?.teacherReviewedRiskLevel ??
    thread.analysis?.systemRiskLevel ??
    threadRiskToSystemRisk[thread.risk]
  );
}

function canGenerateReplyDraft(thread: BoardThread) {
  const riskLevel = getThreadRiskLevel(thread);

  return riskLevel === 'low' || riskLevel === 'medium';
}

function canUseOfficialReplyTemplate(thread: BoardThread) {
  return getThreadRiskLevel(thread) === 'high';
}

function isReplyLocked(thread: BoardThread) {
  return getThreadRiskLevel(thread) === 'emergency';
}

const riskStageGuides: Record<
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

function formatNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('ko-KR', {
    day: '2-digit',
    hour: 'numeric',
    hour12: true,
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((formattedParts, part) => {
      formattedParts[part.type] = part.value;
      return formattedParts;
    }, {});

  return `${parts.year}.${parts.month}.${parts.day} ${parts.dayPeriod} ${parts.hour}:${parts.minute}`;
}

type OriginalHighlightSegment = {
  end: number;
  factor: RiskFactor;
  start: number;
};

function getVisibleRiskFactors(thread: BoardThread) {
  return (
    thread.analysis?.riskFactors.filter(
      (factor) => factor.status !== 'unknown',
    ) ?? []
  );
}

function getBufferedSummaryText(thread: BoardThread) {
  if (!shouldShowBufferedSummary[thread.risk]) {
    return undefined;
  }

  const analysisSummary =
    thread.analysis?.summary.status === 'ready'
      ? thread.analysis.summary.text
      : undefined;

  return thread.moderatedSummary ?? analysisSummary;
}

function getPrimaryParentMessage(thread: BoardThread) {
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

function createAiReplyDraft(thread: BoardThread) {
  const parentName = `${thread.parentName}님`;
  const referenceText = getBufferedSummaryText(thread) ?? getPrimaryParentMessage(thread);
  const visibleRiskFactors = getVisibleRiskFactors(thread);
  const factorNames = visibleRiskFactors
    .slice(0, 2)
    .map((factor) => factor.name)
    .join(', ');
  const templateName = thread.officialTemplates?.[0];
  const searchableContext = `${thread.title} ${thread.latestMessage} ${referenceText}`;

  if (/현장체험|준비물|도시락|물/.test(searchableContext)) {
    return [
      `안녕하세요, ${parentName}.`,
      '현장체험학습 준비물 관련해 문의 주신 내용을 확인했습니다.',
      '안내장에 기재된 준비물을 기준으로 준비해 주시면 되고, 개인 도시락 지참 가능 여부와 물 준비량은 담당 부서 확인 후 정확히 안내드리겠습니다.',
      '확인되는 대로 추가 안내드리겠습니다. 감사합니다.',
    ].join('\n\n');
  }

  if (/방과후|결석|출결/.test(searchableContext)) {
    return [
      `안녕하세요, ${parentName}.`,
      '문의 주신 방과후 수업 결석 처리 내용을 확인했습니다.',
      '방과후 수업 결석은 정규 수업 출결과 별도로 기록되는 항목이라, 담당 선생님과 기록 기준을 한 번 더 확인한 뒤 안내드리겠습니다.',
      '확인 후 필요한 내용이 있으면 추가로 공유드리겠습니다. 감사합니다.',
    ].join('\n\n');
  }

  return [
    `안녕하세요, ${parentName}.`,
    '말씀해 주신 내용을 확인했습니다.',
    factorNames
      ? `${factorNames}와 관련된 부분은 확인되지 않은 내용을 단정하지 않고, 학생 상황과 관련 기록을 먼저 살핀 뒤 안내드리겠습니다.`
      : '확인이 필요한 부분은 관련 기록과 학생 상황을 먼저 살핀 뒤 안내드리겠습니다.',
    templateName
      ? `${templateName}도 함께 확인해, 확인된 내용과 향후 조치를 정리해서 말씀드리겠습니다.`
      : '확인된 내용과 향후 조치를 정리해서 말씀드리겠습니다.',
    '상담은 오늘 오후 4시 이후 또는 내일 오전 10시 중 가능하신 시간으로 조율할 수 있습니다. 편하신 시간을 알려주시면 맞춰 연락드리겠습니다.',
    '감사합니다.',
  ].join('\n\n');
}

function createOfficialTemplateReply(thread: BoardThread) {
  const parentName = `${thread.parentName}님`;
  const templateName = thread.officialTemplates?.[0] ?? '학교 공식 응답 템플릿';

  return [
    `안녕하세요, ${parentName}.`,
    `말씀해 주신 내용은 ${templateName}에 따라 접수하고 확인하겠습니다.`,
    '현재 확인되지 않은 내용은 단정하지 않고, 관련 기록과 학생 상황을 확인한 뒤 학교 절차에 맞게 안내드리겠습니다.',
    '필요한 경우 상담 또는 추가 확인 일정을 별도로 조율하겠습니다.',
    '감사합니다.',
  ].join('\n\n');
}

function getOriginalHighlightSegments(
  message: string,
  riskFactors: RiskFactor[],
) {
  const segments: OriginalHighlightSegment[] = [];

  riskFactors.forEach((factor) => {
    const evidence = factor.evidence.trim();

    if (!evidence) {
      return;
    }

    let searchStart = 0;
    let evidenceIndex = message.indexOf(evidence, searchStart);

    while (evidenceIndex >= 0) {
      const end = evidenceIndex + evidence.length;
      const isOverlapping = segments.some(
        (segment) => evidenceIndex < segment.end && end > segment.start,
      );

      if (!isOverlapping) {
        segments.push({
          end,
          factor,
          start: evidenceIndex,
        });
      }

      searchStart = end;
      evidenceIndex = message.indexOf(evidence, searchStart);
    }
  });

  return segments.sort((a, b) => a.start - b.start);
}

function renderHighlightedOriginalMessage({
  activeFactorId,
  message,
  onSelectRiskFactor,
  riskFactors,
}: {
  activeFactorId?: string;
  message: string;
  onSelectRiskFactor: (factorId: string) => void;
  riskFactors: RiskFactor[];
}): ReactNode {
  if (!message) {
    return '확인 가능한 원문이 없습니다.';
  }

  const segments = getOriginalHighlightSegments(message, riskFactors);

  if (segments.length === 0) {
    return message;
  }

  const nodes: ReactNode[] = [];
  let cursor = 0;

  segments.forEach((segment, index) => {
    if (cursor < segment.start) {
      nodes.push(message.slice(cursor, segment.start));
    }

    nodes.push(
      <button
        aria-label={`${segment.factor.name} 위험 표현 선택`}
        aria-pressed={activeFactorId === segment.factor.id}
        className={`board-original-highlight${
          activeFactorId === segment.factor.id ? ' is-active' : ''
        }`}
        key={`${segment.factor.id}-${segment.start}-${index}`}
        onClick={() => onSelectRiskFactor(segment.factor.id)}
        type="button"
      >
        {message.slice(segment.start, segment.end)}
      </button>,
    );

    cursor = segment.end;
  });

  if (cursor < message.length) {
    nodes.push(message.slice(cursor));
  }

  return nodes;
}

function ExternalLinkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 13 13"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M1.44444 13C1.04722 13 0.707176 12.8586 0.424306 12.5757C0.141435 12.2928 0 11.9528 0 11.5556V1.44444C0 1.04722 0.141435 0.707176 0.424306 0.424306C0.707176 0.141435 1.04722 0 1.44444 0H6.5V1.44444H1.44444V11.5556H11.5556V6.5H13V11.5556C13 11.9528 12.8586 12.2928 12.5757 12.5757C12.2928 12.8586 11.9528 13 11.5556 13H1.44444ZM4.83889 9.17222L3.82778 8.16111L10.5444 1.44444H7.94444V0H13V5.05556H11.5556V2.45556L4.83889 9.17222Z"
        fill="currentColor"
      />
    </svg>
  );
}

function BreadcrumbSeparator() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 7 13"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M1.0552 13 0 11.8462 4.8896 6.5 0 1.15375 1.0552 0 7 6.5 1.0552 13Z"
        fill="currentColor"
      />
    </svg>
  );
}

function FileSearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M4.5 18A1.5 1.5 0 0 1 3 16.5v-13A1.5 1.5 0 0 1 4.5 2h6.35L17 8.15V16.5a1.5 1.5 0 0 1-1.5 1.5h-11Zm5.6-9.1V3.5H4.5v13h11V8.9h-5.4Zm2.36 5.92-1.5-1.5a2.64 2.64 0 0 1-1.32.35A2.68 2.68 0 0 1 6.95 11a2.68 2.68 0 0 1 2.69-2.67A2.68 2.68 0 0 1 12.32 11c0 .48-.13.92-.35 1.3l1.5 1.5-1.01 1.02Zm-2.82-2.55A1.27 1.27 0 1 0 9.64 9.73a1.27 1.27 0 0 0 0 2.54Z"
        fill="currentColor"
      />
    </svg>
  );
}

function EvidencePackageIcon() {
  return (
    <div data-svg-wrapper data-layer="Vector" className="Vector" aria-hidden="true">
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M7 6.75L9 5.75L11 6.75V2H7V6.75ZM4 14V12H9V14H4ZM2 18C1.45 18 0.979167 17.8042 0.5875 17.4125C0.195833 17.0208 0 16.55 0 16V2C0 1.45 0.195833 0.979167 0.5875 0.5875C0.979167 0.195833 1.45 0 2 0H16C16.55 0 17.0208 0.195833 17.4125 0.5875C17.8042 0.979167 18 1.45 18 2V16C18 16.55 17.8042 17.0208 17.4125 17.4125C17.0208 17.8042 16.55 18 16 18H2ZM2 16H16V2H13V10L9 8L5 10V2H2V16Z"
          fill="#FF4B6C"
        />
      </svg>
    </div>
  );
}

function OriginalViewerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 22 15"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M14.1875 10.6875C15.0625 9.8125 15.5 8.75 15.5 7.5C15.5 6.25 15.0625 5.1875 14.1875 4.3125C13.3125 3.4375 12.25 3 11 3C9.75 3 8.6875 3.4375 7.8125 4.3125C6.9375 5.1875 6.5 6.25 6.5 7.5C6.5 8.75 6.9375 9.8125 7.8125 10.6875C8.6875 11.5625 9.75 12 11 12C12.25 12 13.3125 11.5625 14.1875 10.6875ZM9.0875 9.4125C8.5625 8.8875 8.3 8.25 8.3 7.5C8.3 6.75 8.5625 6.1125 9.0875 5.5875C9.6125 5.0625 10.25 4.8 11 4.8C11.75 4.8 12.3875 5.0625 12.9125 5.5875C13.4375 6.1125 13.7 6.75 13.7 7.5C13.7 8.25 13.4375 8.8875 12.9125 9.4125C12.3875 9.9375 11.75 10.2 11 10.2C10.25 10.2 9.6125 9.9375 9.0875 9.4125ZM4.35 12.9625C2.35 11.6042 0.9 9.78333 0 7.5C0.9 5.21667 2.35 3.39583 4.35 2.0375C6.35 0.679167 8.56667 0 11 0C13.4333 0 15.65 0.679167 17.65 2.0375C19.65 3.39583 21.1 5.21667 22 7.5C21.1 9.78333 19.65 11.6042 17.65 12.9625C15.65 14.3208 13.4333 15 11 15C8.56667 15 6.35 14.3208 4.35 12.9625ZM16.1875 11.5125C17.7625 10.5208 18.9667 9.18333 19.8 7.5C18.9667 5.81667 17.7625 4.47917 16.1875 3.4875C14.6125 2.49583 12.8833 2 11 2C9.11667 2 7.3875 2.49583 5.8125 3.4875C4.2375 4.47917 3.03333 5.81667 2.2 7.5C3.03333 9.18333 4.2375 10.5208 5.8125 11.5125C7.3875 12.5042 9.11667 13 11 13C12.8833 13 14.6125 12.5042 16.1875 11.5125Z"
        fill="currentColor"
      />
    </svg>
  );
}

function RiskGuideIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 25"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M13.5 13.5C14.0403 13.5 14.5379 13.6632 14.9795 13.9814C15.3724 14.2647 15.6584 14.6359 15.834 15.082L15.9033 15.2783L15.9043 15.2812L17.7715 21.5H19.5V24.5H4.5V21.5H6.22852L8.0957 15.2812L8.09668 15.2783C8.26113 14.7439 8.57137 14.3052 9.02051 13.9814C9.46209 13.6632 9.95974 13.5 10.5 13.5H13.5ZM6.5 16.5V19.5H0.5V16.5H6.5ZM23.5 16.5V19.5H17.5V16.5H23.5ZM5.27734 9.16992L8.82715 12.6953L9.18359 13.0488L8.82812 13.4033L7.40332 14.8281L7.04883 15.1836L6.69531 14.8271L3.16992 11.2773L2.81934 10.9238L4.92383 8.81934L5.27734 9.16992ZM21.1807 10.9238L20.8301 11.2773L17.3047 14.8271L16.9512 15.1836L16.5967 14.8281L15.1719 13.4033L14.8164 13.0488L15.1729 12.6953L18.7227 9.16992L19.0762 8.81934L21.1807 10.9238ZM13.5 6.5V12.5H10.5V6.5H13.5Z"
        fill="currentColor"
        stroke="white"
      />
    </svg>
  );
}

function RiskSectionIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 25 22"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M10.9507 1.22803C11.5333 0.257113 12.9403 0.257112 13.5229 1.22803L23.7573 18.2847C24.3568 19.2844 23.636 20.5562 22.4702 20.5562H2.00342C0.837628 20.5562 0.116861 19.2844 0.716309 18.2847L10.9507 1.22803ZM12.2368 15.2935C12.0482 15.2935 11.9166 15.35 11.8071 15.4556C11.6987 15.5602 11.6461 15.6788 11.646 15.8452C11.646 16.0118 11.6986 16.1311 11.8071 16.2358C11.9166 16.3414 12.0483 16.3979 12.2368 16.3979C12.4254 16.3979 12.557 16.3414 12.6665 16.2358C12.7751 16.1311 12.8276 16.0118 12.8276 15.8452C12.8276 15.6788 12.775 15.5602 12.6665 15.4556C12.557 15.35 12.4254 15.2935 12.2368 15.2935ZM12.146 8.97705C11.8699 8.97705 11.6461 9.20098 11.646 9.47705V12.7407C11.6462 13.0167 11.87 13.2407 12.146 13.2407H12.3276C12.6037 13.2407 12.8274 13.0167 12.8276 12.7407V9.47705C12.8276 9.20098 12.6037 8.97705 12.3276 8.97705H12.146Z"
        fill="currentColor"
        stroke="white"
      />
    </svg>
  );
}

function ReplyCheckAlertIcon() {
  return (
    <div
      data-svg-wrapper
      data-layer="Vector"
      className="board-reply-check-alert-icon Vector"
      aria-hidden="true"
    >
      <svg
        width="23"
        height="20"
        viewBox="0 0 23 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M9.9707 1.24829C10.5485 0.250693 11.9886 0.2507 12.5664 1.24829L21.832 17.2522C22.411 18.2522 21.6896 19.5041 20.5342 19.5042H2.00293C0.847474 19.5041 0.126143 18.2522 0.705078 17.2522L9.9707 1.24829ZM11.2686 14.5042C11.1111 14.5042 11.0025 14.5515 10.9092 14.6448C10.8159 14.738 10.7686 14.8467 10.7686 15.0042C10.7686 15.1616 10.8159 15.2703 10.9092 15.3635C11.0024 15.4568 11.1111 15.5042 11.2686 15.5042C11.426 15.5042 11.5347 15.4568 11.6279 15.3635C11.7212 15.2703 11.7686 15.1616 11.7686 15.0042C11.7686 14.8467 11.7212 14.738 11.6279 14.6448C11.5347 14.5515 11.426 14.5042 11.2686 14.5042ZM11.2686 8.50415C10.9924 8.50415 10.7686 8.72801 10.7686 9.00415V12.0042C10.7686 12.2803 10.9924 12.5042 11.2686 12.5042C11.5447 12.5042 11.7686 12.2803 11.7686 12.0042V9.00415C11.7686 8.72801 11.5447 8.50415 11.2686 8.50415Z"
          fill="#FF4B6C"
          stroke="white"
        />
      </svg>
    </div>
  );
}

function getRiskFactorIconKind(factor: RiskFactor): RiskFactorIconKind {
  const text = `${factor.id} ${factor.name} ${factor.description}`;

  if (/법적|공식|교육청|신고|고소|민원/.test(text)) {
    return 'official';
  }

  if (/반복|다시|즉시|응답|압박|기한/.test(text)) {
    return 'repeat';
  }

  if (/요구|조치|설명|상담/.test(text)) {
    return 'burden';
  }

  if (/안전|정서|갈등|가정|생활/.test(text)) {
    return 'safety';
  }

  return 'default';
}

function RiskFactorIcon({ factor }: { factor: RiskFactor }) {
  const kind = getRiskFactorIconKind(factor);

  if (kind === 'repeat') {
    return (
      <svg
        aria-hidden="true"
        className="board-risk-factor-icon"
        fill="none"
        viewBox="0 0 25 25"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="25" height="25" rx="8" fill="#F8F8F8" />
        <path
          d="M9.11111 20.5L6 17.3L9.11111 14.1L10.2 15.26L8.99444 16.5H16.8889V13.3H18.4444V18.1H8.99444L10.2 19.34L9.11111 20.5ZM7.55556 11.7V6.9H17.0056L15.8 5.66L16.8889 4.5L20 7.7L16.8889 10.9L15.8 9.74L17.0056 8.5H9.11111V11.7H7.55556Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (kind === 'burden') {
    return (
      <svg
        aria-hidden="true"
        className="board-risk-factor-icon"
        fill="none"
        viewBox="0 0 25 25"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="25" height="25" rx="8" fill="#F8F8F8" />
        <path
          d="M16.6727 13.25L15.5909 12.2L17.1943 10.625L15.5909 9.06875L16.6727 8L18.2955 9.575L19.8989 8L21 9.06875L19.3773 10.625L21 12.2L19.8989 13.25L18.2955 11.6938L16.6727 13.25ZM7.99886 11.6188C7.39356 11.0312 7.09091 10.325 7.09091 9.5C7.09091 8.675 7.39356 7.96875 7.99886 7.38125C8.60417 6.79375 9.33182 6.5 10.1818 6.5C11.0318 6.5 11.7595 6.79375 12.3648 7.38125C12.9701 7.96875 13.2727 8.675 13.2727 9.5C13.2727 10.325 12.9701 11.0312 12.3648 11.6188C11.7595 12.2063 11.0318 12.5 10.1818 12.5C9.33182 12.5 8.60417 12.2063 7.99886 11.6188ZM4 18.5V16.4C4 15.975 4.11269 15.5844 4.33807 15.2281C4.56345 14.8719 4.86288 14.6 5.23636 14.4125C6.03485 14.025 6.84621 13.7344 7.67045 13.5406C8.4947 13.3469 9.33182 13.25 10.1818 13.25C11.0318 13.25 11.8689 13.3469 12.6932 13.5406C13.5174 13.7344 14.3288 14.025 15.1273 14.4125C15.5008 14.6 15.8002 14.8719 16.0256 15.2281C16.2509 15.5844 16.3636 15.975 16.3636 16.4V18.5H4Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (kind === 'official') {
    return (
      <svg
        aria-hidden="true"
        className="board-risk-factor-icon"
        fill="none"
        viewBox="0 0 25 25"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="25" height="25" rx="8" fill="#F8F8F8" />
        <path
          d="M5 21.5V19.7105H15.6667V21.5H5ZM10.0222 17.1605L5 12.1053L6.86667 10.1816L11.9333 15.2368L10.0222 17.1605ZM15.6667 11.4789L10.6444 6.37895L12.5556 4.5L17.5778 9.55526L15.6667 11.4789ZM19.7556 20.6053L8.15556 8.92895L9.4 7.67632L21 19.3526L19.7556 20.6053Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className="board-risk-factor-icon"
      fill="none"
      viewBox="0 0 25 25"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="25" height="25" rx="8" fill="#F8F8F8" />
      <path
        d="M12.5 4.5L4.75 18.5H20.25L12.5 4.5ZM11.75 9.75H13.25V14H11.75V9.75ZM11.75 15.25H13.25V16.75H11.75V15.25Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ProfileAvatar({
  className = 'board-avatar',
}: {
  className?: string;
}) {
  return (
    <img
      alt=""
      aria-hidden="true"
      className={className}
      src={defaultProfileImage}
    />
  );
}

function ThreadAttentionAlert() {
  return (
    <span className="board-thread-attention-alert">
      <span className="board-thread-attention-icon" aria-hidden="true">
        <svg
          fill="none"
          viewBox="0 0 23 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M9.9707 1.24829C10.5485 0.250693 11.9886 0.2507 12.5664 1.24829L21.832 17.2522C22.411 18.2522 21.6896 19.5041 20.5342 19.5042H2.00293C0.847474 19.5041 0.126143 18.2522 0.705078 17.2522L9.9707 1.24829ZM11.2686 14.5042C11.1111 14.5042 11.0025 14.5515 10.9092 14.6448C10.8159 14.738 10.7686 14.8467 10.7686 15.0042C10.7686 15.1616 10.8159 15.2703 10.9092 15.3635C11.0024 15.4568 11.1111 15.5042 11.2686 15.5042C11.426 15.5042 11.5347 15.4568 11.6279 15.3635C11.7212 15.2703 11.7686 15.1616 11.7686 15.0042C11.7686 14.8467 11.7212 14.738 11.6279 14.6448C11.5347 14.5515 11.426 14.5042 11.2686 14.5042ZM11.2686 8.50415C10.9924 8.50415 10.7686 8.72801 10.7686 9.00415V12.0042C10.7686 12.2803 10.9924 12.5042 11.2686 12.5042C11.5447 12.5042 11.7686 12.2803 11.7686 12.0042V9.00415C11.7686 8.72801 11.5447 8.50415 11.2686 8.50415Z"
            fill="#FF4B6C"
            stroke="white"
          />
        </svg>
      </span>
      <span>주의 필요</span>
    </span>
  );
}

type ThreadRowProps = {
  isSelected: boolean;
  onSelect: (threadId: string) => void;
  onToggleStar: (threadId: string) => void;
  thread: BoardThread;
};

function ThreadRow({
  isSelected,
  onSelect,
  onToggleStar,
  thread,
}: ThreadRowProps) {
  const needsAttention = getThreadRiskLevel(thread) !== 'low';

  return (
    <article className="board-thread-row">
      <button
        aria-label={
          thread.isPinned
            ? `${thread.parentName} 별표 해제`
            : `${thread.parentName} 별표 표시`
        }
        aria-pressed={thread.isPinned}
        className="board-thread-star-button"
        onClick={() => onToggleStar(thread.id)}
        type="button"
      >
        <StarIcon
          className={`board-thread-star${thread.isPinned ? ' is-filled' : ''}`}
        />
      </button>

      <button
        aria-current={isSelected ? 'true' : undefined}
        aria-label={`${thread.parentName} 메시지 상세 보기`}
        className={`board-thread-button${isSelected ? ' is-selected' : ''}`}
        onClick={() => onSelect(thread.id)}
        type="button"
      >
        <div className="board-thread-parent">
          <ProfileAvatar />
          <span className="board-parent-copy">
            <strong>{thread.parentName}</strong>
            <span>{thread.className}</span>
          </span>
        </div>

        <div className="board-thread-copy">
          <span className="board-thread-title-row">
            <strong>{thread.title}</strong>
            {needsAttention ? (
              <>
                <span className="board-thread-title-dot" aria-hidden="true" />
                <ThreadAttentionAlert />
              </>
            ) : null}
          </span>
          <span>{thread.latestMessage}</span>
        </div>

        <div className="board-thread-status">
          <StatusChip
            className="board-status-chip"
            label={statusLabel[thread.status]}
            size="md"
            status={statusChipStatus[thread.status]}
          />
        </div>

        <time className="board-thread-time" dateTime={thread.latestAt}>
          {thread.latestAtLabel}
        </time>
      </button>
    </article>
  );
}

type ThreadListProps = {
  emptyDescription: string;
  emptyTitle: string;
  onSelect: (threadId: string) => void;
  onToggleStar: (threadId: string) => void;
  selectedThreadId?: string;
  threads: BoardThread[];
};

function ThreadList({
  emptyDescription,
  emptyTitle,
  onSelect,
  onToggleStar,
  selectedThreadId,
  threads,
}: ThreadListProps) {
  if (threads.length === 0) {
    return (
      <EmptyState
        className="board-empty-state"
        description={emptyDescription}
        title={emptyTitle}
      />
    );
  }

  return (
    <section className="board-thread-list" aria-label="받은 메시지 목록">
      {threads.map((thread) => (
        <ThreadRow
          isSelected={thread.id === selectedThreadId}
          key={thread.id}
          onSelect={onSelect}
          onToggleStar={onToggleStar}
          thread={thread}
        />
      ))}
    </section>
  );
}

type BoardWorkspaceProps = {
  activeFilter: FilterValue;
  emptyDescription: string;
  emptyTitle: string;
  onFilterChange: (value: FilterValue) => void;
  onQueryChange: (value: string) => void;
  onSelect: (threadId: string) => void;
  onToggleStar: (threadId: string) => void;
  query: string;
  selectedThreadId?: string;
  threads: BoardThread[];
};

function BoardWorkspace({
  activeFilter,
  emptyDescription,
  emptyTitle,
  onFilterChange,
  onQueryChange,
  onSelect,
  onToggleStar,
  query,
  selectedThreadId,
  threads,
}: BoardWorkspaceProps) {
  return (
    <>
      <div className="board-toolbar">
        <Dropdown
          ariaLabel="메시지 처리 상태 필터"
          className="board-filter-select"
          menuLabel="메시지 처리 상태"
          onValueChange={(nextValue) => onFilterChange(nextValue as FilterValue)}
          options={filterOptions}
          value={activeFilter}
        />

        <TextField
          aria-label="메시지 검색"
          containerClassName="board-search-field"
          leadingIcon={<SearchIcon />}
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          placeholder="이름 또는 메시지 내용으로 검색"
          type="search"
          value={query}
        />
      </div>

      <ThreadList
        emptyDescription={emptyDescription}
        emptyTitle={emptyTitle}
        onSelect={onSelect}
        onToggleStar={onToggleStar}
        selectedThreadId={selectedThreadId}
        threads={threads}
      />
    </>
  );
}

function TabLabel({ count, label }: { count: number; label: string }) {
  return (
    <span className="board-tab-label">
      <span>{label}</span>
      <span>{count}</span>
    </span>
  );
}

type DraftResumeDialogProps = {
  onClose: () => void;
  onContinue: () => void;
  open: boolean;
};

type BoardConfirmDialogAction = {
  label: string;
  onClick: () => void;
  tone?: 'danger' | 'primary';
};

type BoardConfirmDialogProps = {
  actions: BoardConfirmDialogAction[];
  children?: ReactNode;
  descriptionId?: string;
  onClose: () => void;
  open: boolean;
  title: ReactNode;
  titleHidden?: boolean;
  titleId: string;
};

function ConfirmCloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M6.4 19 5 17.6 10.6 12 5 6.4 6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19Z"
        fill="currentColor"
      />
    </svg>
  );
}

function BoardConfirmDialog({
  actions,
  children,
  descriptionId,
  onClose,
  open,
  title,
  titleHidden = false,
  titleId,
}: BoardConfirmDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="board-confirm-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <section
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="board-confirm-modal"
        role="dialog"
      >
        <button
          aria-label="닫기"
          className="board-confirm-modal-close"
          onClick={onClose}
          type="button"
        >
          <ConfirmCloseIcon aria-hidden="true" />
        </button>
        <div className="board-confirm-modal-content">
          <h2
            className={titleHidden ? 'sr-only' : 'board-confirm-modal-title'}
            id={titleId}
          >
            {title}
          </h2>
          {children}
        </div>
        <div className="board-confirm-modal-actions">
          {actions.map((action, index) => {
            const className = [
              'board-confirm-modal-action',
              action.tone ? `board-confirm-modal-action--${action.tone}` : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <button
                className={className}
                key={`${action.label}-${index}`}
                onClick={action.onClick}
                type="button"
              >
                {action.label}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function DraftResumeDialog({
  onClose,
  onContinue,
  open,
}: DraftResumeDialogProps) {
  return (
    <BoardConfirmDialog
      actions={[
        {
          label: '이어서 작성',
          onClick: onContinue,
          tone: 'danger',
        },
      ]}
      onClose={onClose}
      open={open}
      title={
        <>
          작성 중인 답변이 있어요.
          <br />
          이어서 작성하시겠어요?
        </>
      }
      titleId="board-draft-modal-title"
    />
  );
}

type OriginalMessageRequest = {
  evidence?: string;
  source?: 'detail' | 'replyComposer';
};

type OriginalMessageConfirmDialogProps = {
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
};

function OriginalMessageConfirmDialog({
  onCancel,
  onConfirm,
  open,
}: OriginalMessageConfirmDialogProps) {
  return (
    <BoardConfirmDialog
      actions={[
        {
          label: '취소',
          onClick: onCancel,
        },
        {
          label: '원문 확인',
          onClick: onConfirm,
          tone: 'primary',
        },
      ]}
      descriptionId="board-original-confirm-description"
      onClose={onCancel}
      open={open}
      title="원문 열람 안내"
      titleHidden
      titleId="board-original-confirm-title"
    >
      <p
        className="board-confirm-modal-copy"
        id="board-original-confirm-description"
      >
        원문에는 정서적으로 부담이 될 수 있는 표현이 포함되어 있습니다.
        <br />
        <br />
        원문을 확인하시겠습니까?
        <br />
        <br />
        원문을 열람하면 열람 기록이 저장됩니다.
      </p>
    </BoardConfirmDialog>
  );
}

type OriginalMessageViewerProps = {
  selectedEvidence?: string;
  thread: BoardThread;
};

function OriginalMessageViewer({
  selectedEvidence,
  thread,
}: OriginalMessageViewerProps) {
  const [isRiskListOpen, setIsRiskListOpen] = useState(true);
  const riskFactors = useMemo(() => getVisibleRiskFactors(thread), [thread]);
  const highlightedRiskFactors = useMemo(
    () =>
      riskFactors.filter(
        (factor) =>
          Boolean(factor.evidence.trim()) &&
          Boolean(thread.originalMessage?.includes(factor.evidence)),
      ),
    [riskFactors, thread.originalMessage],
  );
  const initialActiveFactorId =
    highlightedRiskFactors.find((factor) => factor.evidence === selectedEvidence)
      ?.id ??
    highlightedRiskFactors[0]?.id ??
    riskFactors[0]?.id;
  const [activeFactorId, setActiveFactorId] = useState<string | undefined>(
    initialActiveFactorId,
  );
  const [expandedFactorIds, setExpandedFactorIds] = useState<string[]>(
    initialActiveFactorId ? [initialActiveFactorId] : [],
  );
  const activeFactor = riskFactors.find(
    (factor) => factor.id === activeFactorId,
  );
  const detectedCount = highlightedRiskFactors.length || riskFactors.length;

  useEffect(() => {
    setActiveFactorId(initialActiveFactorId);
    setExpandedFactorIds(initialActiveFactorId ? [initialActiveFactorId] : []);
  }, [initialActiveFactorId, thread.id]);
  const expandAndSelectRiskFactor = (factorId: string) => {
    setActiveFactorId(factorId);
    setExpandedFactorIds((currentFactorIds) =>
      currentFactorIds.includes(factorId)
        ? currentFactorIds
        : [...currentFactorIds, factorId],
    );
  };
  const toggleRiskFactor = (factorId: string) => {
    setActiveFactorId(factorId);
    setExpandedFactorIds((currentFactorIds) =>
      currentFactorIds.includes(factorId)
        ? currentFactorIds.filter((currentFactorId) => currentFactorId !== factorId)
        : [...currentFactorIds, factorId],
    );
  };

  return (
    <div className="board-original-viewer">
      <div className="board-info-box board-original-viewer-info">
        <span aria-hidden="true">i</span>
        <p>
          원문은 학부모가 최종 전송한 내용입니다.
          <br />
          하이라이트된 표현을 선택해 탐지된 위험 요소와 판단 이유를 확인해
          주세요.
        </p>
      </div>

      <section
        aria-labelledby="board-original-message-title"
        className="board-original-viewer-panel board-original-message-panel"
      >
        <div className="board-original-viewer-header">
          <div>
            <OriginalViewerIcon className="board-original-viewer-title-icon" />
            <h2 id="board-original-message-title">원문 확인</h2>
          </div>
        </div>
        <p className="board-original-viewer-message">
          {renderHighlightedOriginalMessage({
            activeFactorId,
            message: thread.originalMessage ?? '',
            onSelectRiskFactor: expandAndSelectRiskFactor,
            riskFactors,
          })}
        </p>
      </section>

      <section
        aria-labelledby="board-original-risk-title"
        className="board-original-viewer-panel board-original-risk-panel"
      >
        <div className="board-original-viewer-header">
          <div>
            <RiskGuideIcon className="board-original-risk-title-icon" />
            <h2 id="board-original-risk-title">
              탐지된 위험 표현 목록 ({detectedCount})
            </h2>
          </div>
          <button
            aria-expanded={isRiskListOpen}
            className="board-outline-button board-original-risk-toggle"
            onClick={() => setIsRiskListOpen((isOpen) => !isOpen)}
            type="button"
          >
            <span>{isRiskListOpen ? '접기' : '펼치기'}</span>
            <svg
              aria-hidden="true"
              className={isRiskListOpen ? 'is-open' : ''}
              fill="none"
              viewBox="0 0 12 8"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M6 7.4 0 1.4 1.4 0 6 4.575 10.6 0 12 1.4 6 7.4Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>

        {isRiskListOpen ? (
          riskFactors.length > 0 ? (
            <div className="board-original-risk-list">
              {riskFactors.map((factor) => {
                const isExpanded = expandedFactorIds.includes(factor.id);

                return (
                  <article
                    className={`board-original-risk-card${
                      isExpanded ? ' is-expanded' : ''
                    }`}
                    key={factor.id}
                  >
                    <button
                      aria-expanded={isExpanded}
                      className="board-original-risk-card-trigger"
                      onClick={() => toggleRiskFactor(factor.id)}
                      type="button"
                    >
                      <span className="board-original-risk-card-title">
                        <RiskFactorIcon factor={factor} />
                        <strong>{factor.name}</strong>
                      </span>
                      <svg
                        aria-hidden="true"
                        className={isExpanded ? 'is-open' : ''}
                        fill="none"
                        viewBox="0 0 12 8"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M6 7.4 0 1.4 1.4 0 6 4.575 10.6 0 12 1.4 6 7.4Z"
                          fill="currentColor"
                        />
                      </svg>
                    </button>
                    {factor.evidence ? (
                      <button
                        className="board-original-risk-evidence"
                        onClick={() => expandAndSelectRiskFactor(factor.id)}
                        type="button"
                      >
                        <span
                          aria-hidden="true"
                          className="board-original-risk-evidence-marker"
                        />
                        <span className="board-original-highlight">
                          “{factor.evidence}”
                        </span>
                      </button>
                    ) : null}
                    {isExpanded ? (
                      <div className="board-original-risk-detail">
                        <div>
                          <strong>설명</strong>
                          <p>{factor.description}</p>
                        </div>
                        <div>
                          <strong>판단 근거</strong>
                          <p>{factor.rationale}</p>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              className="board-risk-empty board-risk-factor-empty"
              description="이 메시지에서는 별도 위험 요소가 감지되지 않았습니다."
              title="없음"
            />
          )
        ) : activeFactor ? (
          <p className="board-original-risk-collapsed">
            선택된 표현: “{activeFactor.evidence || activeFactor.name}”
          </p>
        ) : null}
      </section>
    </div>
  );
}

type RiskFactorTitleProps = {
  factor: RiskFactor;
};

function RiskFactorTitle({ factor }: RiskFactorTitleProps) {
  return (
    <span
      className={`board-risk-factor-title board-risk-factor-title--${factor.status}`}
    >
      <RiskFactorIcon factor={factor} />
      <span className="board-risk-factor-copy">
        <strong>{factor.name}</strong>
        <span>{factor.description}</span>
      </span>
    </span>
  );
}

type RiskFactorDetailProps = {
  factor: RiskFactor;
};

function RiskFactorDetail({ factor }: RiskFactorDetailProps) {
  return (
    <div className="board-risk-factor-detail">
      <p>{factor.rationale}</p>
    </div>
  );
}

type RiskReviewPanelProps = {
  canReview: boolean;
  level: SystemRiskLevel;
  onLevelChange: (level: SystemRiskLevel) => void;
  onReasonChange: (reason: string) => void;
  onSubmit: () => void;
  reason: string;
  referenceLevel: SystemRiskLevel;
  threadId: string;
};

function RiskReviewPanel({
  canReview,
  level,
  onLevelChange,
  onReasonChange,
  onSubmit,
  reason,
  referenceLevel,
  threadId,
}: RiskReviewPanelProps) {
  const trimmedReason = reason.trim();
  const reasonInputId = `board-risk-review-reason-${threadId}`;
  const reasonRequirementId = `${reasonInputId}-requirement`;
  const selectedLevelIndex = Math.max(
    0,
    systemRiskReviewLevels.indexOf(level),
  );
  const referenceLevelIndex = Math.max(
    0,
    systemRiskReviewLevels.indexOf(referenceLevel),
  );
  const isDownwardReview = selectedLevelIndex < referenceLevelIndex;
  const isUpwardReview = selectedLevelIndex > referenceLevelIndex;
  const isEmergencyDowngrade =
    referenceLevel === 'emergency' && isDownwardReview;
  const isReasonRequired = isDownwardReview;
  const isSubmitDisabledByReason =
    isReasonRequired && trimmedReason.length === 0;
  const reviewInfoText = isEmergencyDowngrade
    ? '긴급 단계 하향은 관리자 또는 별도 책임자의 확인 후 반영됩니다.'
    : isDownwardReview
      ? '하향 수정 사유는 오탐 원인 분석과 임계값 재조정에 활용됩니다.'
      : isUpwardReview
        ? '상향 수정은 즉시 반영되며 수정 전후 기록이 저장됩니다.'
        : '수정 전·후 위험도, 수정자, 수정 시각은 처리 기록에 저장됩니다.';
  const submitLabel = isEmergencyDowngrade
    ? '확인 요청'
    : isDownwardReview
      ? '하향 반영'
      : isUpwardReview
        ? '상향 반영'
        : '검토 완료';
  const handleSliderChange = (value: string) => {
    onLevelChange(systemRiskReviewLevels[Number(value)]);
  };

  return (
    <section
      aria-labelledby="board-risk-review-title"
      className="board-risk-review-panel"
    >
      <div className="board-risk-review-overview">
        <div className="board-risk-review-copy">
          <h2 className="board-risk-section-title" id="board-risk-review-title">
            위험도 검토
          </h2>
          <p>이 메시지의 위험도를 어떻게 판단하시나요?</p>
        </div>

        <div
          className={`board-risk-review-slider board-risk-review-slider--${level} board-risk-review-slider-current--${referenceLevel}`}
        >
          <div className="board-risk-current-marker" aria-hidden="true">
            <span>
              <svg
                className="board-risk-current-marker-union"
                fill="none"
                viewBox="0 0 65 27"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M59 0C62.3137 0 65 2.68629 65 6V16C65 19.3137 62.3137 22 59 22H36.2109L33.4551 26.0391C33.0581 26.6209 32.1997 26.6209 31.8027 26.0391L29.0469 22H6C2.68629 22 9.66416e-08 19.3137 0 16V6C0 2.68629 2.68629 6.84522e-08 6 0H59Z"
                  fill="currentColor"
                />
              </svg>
              <strong>현재 단계</strong>
            </span>
          </div>
          <div className="board-risk-review-control">
            <span aria-hidden="true" className="board-risk-review-line" />
            <input
              aria-label="위험도 단계"
              aria-valuetext={systemRiskLabel[level]}
              className="board-risk-review-range"
              disabled={!canReview}
              max={systemRiskReviewLevels.length - 1}
              min={0}
              onChange={(event) => handleSliderChange(event.target.value)}
              step={1}
              type="range"
              value={selectedLevelIndex}
            />
            <span className="board-risk-review-thumb" />
          </div>
          <div
            aria-label="위험도 단계 선택"
            className="board-risk-review-levels"
            role="group"
          >
            {systemRiskReviewLevels.map((currentLevel) => (
              <button
                aria-pressed={level === currentLevel}
                className={
                  level === currentLevel
                    ? 'board-risk-review-level is-active'
                    : 'board-risk-review-level'
                }
                disabled={!canReview}
                key={currentLevel}
                onClick={() => onLevelChange(currentLevel)}
                type="button"
              >
                {systemRiskLabel[currentLevel]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="board-risk-review-reason">
        <label htmlFor={reasonInputId}>
          <span>검토 사유 </span>
          {isReasonRequired ? (
            <strong>
              <span aria-hidden="true">*</span>
              <span className="sr-only">필수</span>
            </strong>
          ) : null}
        </label>
        <div className="board-risk-review-textarea-shell">
          <textarea
            aria-describedby={
              isReasonRequired ? reasonRequirementId : undefined
            }
            aria-required={isReasonRequired ? true : undefined}
            disabled={!canReview}
            id={reasonInputId}
            maxLength={300}
            onChange={(event) => onReasonChange(event.target.value)}
            placeholder={
              isReasonRequired
                ? '하향 수정 사유를 입력해주세요.'
                : '검토 사유를 입력해주세요.'
            }
            value={reason}
          />
          <span>{reason.length} / 300</span>
        </div>
        {isReasonRequired ? (
          <p
            className="board-risk-review-required-note"
            id={reasonRequirementId}
          >
            하향 검토 시 검토 사유를 입력해야 하향 반영할 수 있습니다.
          </p>
        ) : null}
      </div>

      <div className="board-risk-review-footer">
        <div className="board-risk-review-info">
          <svg
            aria-hidden="true"
            fill="none"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M9 15H11V9H9V15ZM10.7125 6.7125C10.9042 6.52083 11 6.28333 11 6C11 5.71667 10.9042 5.47917 10.7125 5.2875C10.5208 5.09583 10.2833 5 10 5C9.71667 5 9.47917 5.09583 9.2875 5.2875C9.09583 5.47917 9 5.71667 9 6C9 6.28333 9.09583 6.52083 9.2875 6.7125C9.47917 6.90417 9.71667 7 10 7C10.2833 7 10.5208 6.90417 10.7125 6.7125ZM10 20C8.61667 20 7.31667 19.7375 6.1 19.2125C4.88333 18.6875 3.825 17.975 2.925 17.075C2.025 16.175 1.3125 15.1167 0.7875 13.9C0.2625 12.6833 0 11.3833 0 10C0 8.61667 0.2625 7.31667 0.7875 6.1C1.3125 4.88333 2.025 3.825 2.925 2.925C3.825 2.025 4.88333 1.3125 6.1 0.7875C7.31667 0.2625 8.61667 0 10 0C11.3833 0 12.6833 0.2625 13.9 0.7875C15.1167 1.3125 16.175 2.025 17.075 2.925C17.975 3.825 18.6875 4.88333 19.2125 6.1C19.7375 7.31667 20 8.61667 20 10C20 11.3833 19.7375 12.6833 19.2125 13.9C18.6875 15.1167 17.975 16.175 17.075 17.075C16.175 17.975 15.1167 18.6875 13.9 19.2125C12.6833 19.7375 11.3833 20 10 20Z"
              fill="currentColor"
            />
          </svg>
          <span>{reviewInfoText}</span>
        </div>
        <button
          aria-describedby={
            isSubmitDisabledByReason ? reasonRequirementId : undefined
          }
          className="board-primary-button board-risk-review-submit"
          disabled={!canReview || isSubmitDisabledByReason}
          onClick={onSubmit}
          type="button"
        >
          {submitLabel}
        </button>
      </div>
    </section>
  );
}

type RiskAnalysisPanelProps = {
  onEvidencePackageCreate: (threadId: string) => void;
  onReviewComplete: (threadId: string, review: RiskReviewSubmission) => void;
  onOriginalOpen: (evidence?: string) => void;
  onReviewRequest: (threadId: string) => void;
  thread: BoardThread;
};

function RiskAnalysisPanel({
  onEvidencePackageCreate,
  onReviewComplete,
  onOriginalOpen,
  onReviewRequest,
  thread,
}: RiskAnalysisPanelProps) {
  const [isProcedureOpen, setIsProcedureOpen] = useState(false);
  const analysis = thread.analysis;
  const initialReviewLevel =
    analysis?.teacherReviewedRiskLevel ?? analysis?.systemRiskLevel ?? 'low';
  const [reviewLevel, setReviewLevel] =
    useState<SystemRiskLevel>(initialReviewLevel);
  const [reviewReason, setReviewReason] = useState(
    analysis?.teacherReviewReason ?? '',
  );

  useEffect(() => {
    setReviewLevel(initialReviewLevel);
    setReviewReason(analysis?.teacherReviewReason ?? '');
  }, [analysis?.teacherReviewReason, initialReviewLevel, thread.id]);

  if (!analysis) {
    return (
      <EmptyState
        className="board-risk-empty"
        description="AI 분석 결과가 연결되면 위험 요소와 판단 근거를 확인할 수 있습니다."
        title="표시할 위험 요소가 없습니다"
      />
    );
  }

  const canInspectOriginal = Boolean(
    analysis.canViewOriginal &&
      analysis.originalMessageAvailable &&
      thread.originalMessage,
  );
  const effectiveRiskLevel =
    analysis.teacherReviewedRiskLevel ?? analysis.systemRiskLevel;
  const currentTone = systemRiskTone[effectiveRiskLevel];
  const currentGuide = riskStageGuides[effectiveRiskLevel];
  const visibleRiskFactors = analysis.riskFactors.filter(
    (factor) => factor.status !== 'unknown',
  );
  const studentSafetyFactor = visibleRiskFactors.find((factor) =>
    /안전|정서|학생/.test(
      `${factor.id} ${factor.name} ${factor.description}`,
    ),
  );
  const riskFactorItems = visibleRiskFactors.map((factor) => ({
    id: factor.id,
    title: <RiskFactorTitle factor={factor} />,
    content: <RiskFactorDetail factor={factor} />,
  }));
  const hasGuideAction = Boolean(currentGuide.action && currentGuide.actionLabel);
  const isProcedureGuide = currentGuide.action === 'procedure';
  const isEmergencyGuide = effectiveRiskLevel === 'emergency';
  const canUseGuideAction =
    hasGuideAction && (isProcedureGuide || canInspectOriginal);
  const canShowEvidenceOriginalButton =
    effectiveRiskLevel !== 'low' && canInspectOriginal;
  const canShowReviewPanel =
    analysis.canReviewRisk ||
    Boolean(analysis.teacherReviewedRiskLevel) ||
    analysis.safetyLock ||
    thread.riskReviewRequired;
  const canShowStudentSafetyCard = analysis.studentSafetySignal !== 'NONE';
  const canShowEvidencePackage =
    effectiveRiskLevel === 'high' || effectiveRiskLevel === 'emergency';
  const handleGuideAction = () => {
    if (isEmergencyGuide) {
      openGuidePostFromMessages(
        thread.id,
        'detail',
        emergencyOfficialProcedurePostId,
      );
      return;
    }

    if (isProcedureGuide) {
      setIsProcedureOpen((isOpen) => !isOpen);
      return;
    }

    if (currentGuide.action === 'original') {
      onOriginalOpen();
    }
  };
  const handleReviewSubmit = () => {
    const reason = reviewReason.trim();
    const selectedLevelIndex = systemRiskReviewLevels.indexOf(reviewLevel);
    const referenceLevelIndex = systemRiskReviewLevels.indexOf(initialReviewLevel);

    if (
      !analysis.canReviewRisk ||
      (selectedLevelIndex < referenceLevelIndex && !reason)
    ) {
      return;
    }

    onReviewComplete(thread.id, {
      level: reviewLevel,
      reason,
    });
  };

  return (
    <div className="board-risk-tab">
      <section
        className={`board-risk-guide board-risk-guide--${currentTone}${
          isProcedureOpen ? ' is-expanded' : ''
        }`}
      >
        <div className="board-risk-guide-copy">
          <RiskGuideIcon className="board-risk-guide-icon" />
          <strong>{currentGuide.headline}</strong>
          {hasGuideAction ? (
            <button
              className="board-outline-button board-risk-action-button board-risk-guide-button"
              disabled={!canUseGuideAction}
              onClick={handleGuideAction}
              aria-expanded={
                isProcedureGuide && !isEmergencyGuide
                  ? isProcedureOpen
                  : undefined
              }
              type="button"
            >
              <span>{currentGuide.actionLabel}</span>
              <ExternalLinkIcon />
            </button>
          ) : null}
          <span className="board-risk-guide-description">
            {currentGuide.description}
            {currentGuide.note ? (
              <>
                <br />
                {currentGuide.note}
              </>
            ) : null}
          </span>
          {isProcedureGuide && isProcedureOpen ? (
            <div className="board-risk-guide-procedure">
              <strong>{currentGuide.procedureTitle}</strong>
              <ol>
                {currentGuide.procedureItems?.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
              {thread.officialTemplates?.length ? (
                <p>
                  사용 가능 템플릿: {thread.officialTemplates.join(', ')}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className="board-risk-evidence-panel">
        <div className="board-risk-section-header">
          <div>
            <RiskSectionIcon />
            <h2 className="board-risk-section-title">
              확인된 위험 요소와 판단 근거
            </h2>
          </div>
          {canShowEvidenceOriginalButton ? (
            <button
              className="board-outline-button board-risk-action-button"
              onClick={() => onOriginalOpen()}
              type="button"
            >
              <span>원문 보기</span>
              <ExternalLinkIcon />
            </button>
          ) : null}
        </div>

        {riskFactorItems.length > 0 ? (
          <Accordion
            allowMultiple
            className="board-risk-factor-accordion"
            items={riskFactorItems}
          />
        ) : (
          <EmptyState
            className="board-risk-empty board-risk-factor-empty"
            description="이 메시지에서는 별도 위험 요소가 감지되지 않았습니다."
            title="없음"
          />
        )}
      </section>

      {canShowReviewPanel ? (
        <RiskReviewPanel
          canReview={analysis.canReviewRisk}
          level={reviewLevel}
          onLevelChange={setReviewLevel}
          onReasonChange={setReviewReason}
          onSubmit={handleReviewSubmit}
          reason={reviewReason}
          referenceLevel={initialReviewLevel}
          threadId={thread.id}
        />
      ) : null}

      {analysis.safetyLock || thread.riskReviewRequired ? (
        <section className="board-risk-lock-review">
          <div className="board-risk-lock-content">
            <div className="board-risk-lock-notice">
              <div className="board-risk-lock-heading">
                <span className="board-lock-icon" aria-hidden="true">
                  <svg
                    fill="none"
                    viewBox="0 0 25 25"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle cx="12.5" cy="12.5" fill="#FF4B6C" r="12.5" />
                    <path
                      d="M8.375 19C7.99688 19 7.67318 18.8788 7.40391 18.6363C7.13464 18.3938 7 18.1024 7 17.7619V11.5714C7 11.231 7.13464 10.9395 7.40391 10.697C7.67318 10.4546 7.99688 10.3333 8.375 10.3333H9.0625V9.09524C9.0625 8.23889 9.39766 7.50893 10.068 6.90536C10.7383 6.30179 11.549 6 12.5 6C13.451 6 14.2617 6.30179 14.932 6.90536C15.6023 7.50893 15.9375 8.23889 15.9375 9.09524V10.3333H16.625C17.0031 10.3333 17.3268 10.4546 17.5961 10.697C17.8654 10.9395 18 11.231 18 11.5714V17.7619C18 18.1024 17.8654 18.3938 17.5961 18.6363C17.3268 18.8788 17.0031 19 16.625 19H8.375ZM13.4711 15.5411C13.7404 15.2986 13.875 15.0071 13.875 14.6667C13.875 14.3262 13.7404 14.0347 13.4711 13.7923C13.2018 13.5498 12.8781 13.4286 12.5 13.4286C12.1219 13.4286 11.7982 13.5498 11.5289 13.7923C11.2596 14.0347 11.125 14.3262 11.125 14.6667C11.125 15.0071 11.2596 15.2986 11.5289 15.5411C11.7982 15.7835 12.1219 15.9048 12.5 15.9048C12.8781 15.9048 13.2018 15.7835 13.4711 15.5411ZM10.4375 10.3333H14.5625V9.09524C14.5625 8.57937 14.362 8.14087 13.9609 7.77976C13.5599 7.41865 13.0729 7.2381 12.5 7.2381C11.9271 7.2381 11.4401 7.41865 11.0391 7.77976C10.638 8.14087 10.4375 8.57937 10.4375 9.09524V10.3333Z"
                      fill="white"
                    />
                  </svg>
                </span>
                <strong>현재 답변 작성이 제한되어 있습니다.</strong>
              </div>
              <p>담당자가 위험도를 검토한 후 답변을 작성할 수 있습니다.</p>
            </div>
          </div>
          <div className="board-risk-lock-actions">
            <button
              className="board-outline-button board-risk-recheck-button"
              disabled={!analysis.canReviewRisk}
              onClick={() => onReviewRequest(thread.id)}
              type="button"
            >
              재검토 요청
            </button>
          </div>
        </section>
      ) : null}

      {canShowEvidencePackage ? (
        <section className="board-risk-workflow-panel">
          <div className="board-risk-section-header">
            <div>
              <EvidencePackageIcon />
              <h2 className="board-risk-section-title">증빙 패키지</h2>
            </div>
            <button
              className="board-outline-button board-risk-action-button"
              disabled={!analysis.packageAvailable || thread.evidencePackageGenerated}
              onClick={() => onEvidencePackageCreate(thread.id)}
              type="button"
            >
              <span>
                {thread.evidencePackageGenerated
                  ? '증빙 패키지 생성됨'
                  : '증빙 패키지 생성'}
              </span>
              <ExternalLinkIcon />
            </button>
          </div>
          <p>
            완충 요약, 원문, 위험 요소, 판단 근거, 처리 기록을 하나의 확인
            묶음으로 보존합니다.
          </p>
        </section>
      ) : null}

      {canShowStudentSafetyCard ? (
        <section className="board-student-safety-card">
          <div className="board-student-safety-content">
            <div className="board-student-safety-copy">
              <h2>학생 안전 관련 확인</h2>
              <div className="board-student-safety-row">
                <p>
                  <span>
                    학생 안전과 관련해 추가 확인이 필요할 수 있습니다.
                  </span>
                  <span>
                    자동 신고는 진행되지 않으며, 필요한 경우 내용을 직접
                    확인해주세요.
                  </span>
                </p>
                <button
                  className="board-outline-button board-risk-action-button"
                  disabled={!canInspectOriginal}
                  onClick={() => onOriginalOpen(studentSafetyFactor?.evidence)}
                  type="button"
                >
                  <span>관련 내용 확인</span>
                  <ExternalLinkIcon />
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

    </div>
  );
}

type ActivityLogPanelProps = {
  thread: BoardThread;
};

function ActivityLogPanel({ thread }: ActivityLogPanelProps) {
  const logs = thread.analysis?.activityLogs ?? [];

  if (logs.length === 0) {
    return (
      <EmptyState
        className="board-risk-empty"
        description="위험 요소 확인, 원문 열람, 재검토 요청 기록이 이곳에 쌓입니다."
        title="처리 기록이 없습니다"
      />
    );
  }

  return (
    <section className="board-activity-panel" aria-label="처리 기록">
      <div className="board-risk-section-header">
        <div>
          <FileSearchIcon aria-hidden="true" />
          <h2 className="board-risk-section-title">처리 기록</h2>
        </div>
      </div>
      <ol className="board-activity-list">
        {logs.map((log) => (
          <li key={log.id}>
            <time>{log.time}</time>
            <div>
              <strong>{log.action}</strong>
              <span>{log.actor}</span>
              <p>{log.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

type DetailProps = {
  initialOriginalViewer?: OriginalMessageRequest;
  initialTab?: DetailTab;
  onBack: () => void;
  onEvidencePackageCreate: (threadId: string) => void;
  onOpenReplyComposer: (threadId: string) => void;
  onOriginalViewed: (threadId: string, evidence?: string) => void;
  onReturnToReplyComposer: (threadId: string) => void;
  onReviewComplete: (threadId: string, review: RiskReviewSubmission) => void;
  onReviewRequest: (threadId: string) => void;
  thread: BoardThread;
};

function ThreadDetail({
  initialOriginalViewer,
  initialTab,
  onBack,
  onEvidencePackageCreate,
  onOpenReplyComposer,
  onOriginalViewed,
  onReturnToReplyComposer,
  onReviewComplete,
  onReviewRequest,
  thread,
}: DetailProps) {
  const [activeDetailTab, setActiveDetailTab] =
    useState<DetailTab>(initialTab ?? 'conversation');
  const [originalRequest, setOriginalRequest] =
    useState<OriginalMessageRequest | null>(null);
  const [originalViewer, setOriginalViewer] =
    useState<OriginalMessageRequest | null>(initialOriginalViewer ?? null);
  const isLocked = isReplyLocked(thread);
  const effectiveRiskLevel = getThreadRiskLevel(thread);
  const hasDraft = thread.draftText.trim().length > 0;
  const lockedGuide =
    riskStageGuides[
      thread.analysis?.systemRiskLevel ?? threadRiskToSystemRisk[thread.risk]
    ];
  const bufferedSummaryText = getBufferedSummaryText(thread);
  const visibleConversationReplies = bufferedSummaryText
    ? thread.replies.filter((reply) => reply.authorRole !== 'parent')
    : thread.replies;
  const showBufferedSummaryOnly =
    Boolean(bufferedSummaryText) && visibleConversationReplies.length === 0;
  const canInspectOriginal = Boolean(
    thread.analysis?.canViewOriginal &&
      thread.analysis.originalMessageAvailable &&
      thread.originalMessage,
  );
  const conversationInfoText =
    effectiveRiskLevel === 'low'
      ? '일반 단계 메시지는 원문을 기준으로 확인합니다. 답변 작성 시 원문과 관련 자료를 바탕으로 초안을 생성할 수 있습니다.'
      : (
          <>
            주의 이상 단계의 학부모 게시글은 완충 요약으로 먼저 표시됩니다.
            <br />
            필요 시 원문 보기와 판단 근거를 함께 확인한 뒤 답변을 남길 수
            있습니다.
          </>
        );

  useEffect(() => {
    setActiveDetailTab(initialTab ?? 'conversation');
    setOriginalRequest(null);
    setOriginalViewer(initialOriginalViewer ?? null);
  }, [initialOriginalViewer, initialTab, thread.id]);

  const openOriginalViewer = (evidence?: string) => {
    if (!canInspectOriginal) {
      return;
    }

    setOriginalRequest({ evidence, source: 'detail' });
  };

  const confirmOriginalViewer = () => {
    if (!originalRequest) {
      return;
    }

    setOriginalViewer(originalRequest);
    setOriginalRequest(null);
    onOriginalViewed(thread.id, originalRequest.evidence);
  };
  const closeOriginalViewer = () => {
    if (originalViewer?.source === 'replyComposer') {
      onReturnToReplyComposer(thread.id);
      return;
    }

    setOriginalViewer(null);
  };

  return (
    <section className="board-detail" aria-labelledby="board-detail-title">
      <header className="board-detail-page-header">
        <div className="board-detail-title-group">
          <button
            aria-label={
              originalViewer ? '이전 화면으로 돌아가기' : '목록으로 돌아가기'
            }
            className="board-back-button"
            onClick={originalViewer ? closeOriginalViewer : onBack}
            type="button"
          >
            <svg
              aria-hidden="true"
              fill="none"
              viewBox="0 0 16 15"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3.825 8.24079 9.425 13.3684 8 14.6503 0 7.32515 8 0l1.425 1.2819-5.6 5.1276H16v1.83129H3.825Z"
                fill="currentColor"
              />
            </svg>
          </button>
          <h1 id="board-detail-title">메시지 상세</h1>
        </div>

        <nav aria-label="현재 위치" className="board-page-nav">
          <button onClick={onBack} type="button">
            홈
          </button>
          <BreadcrumbSeparator />
          <button onClick={onBack} type="button">
            메시지
          </button>
          <BreadcrumbSeparator />
          <button
            onClick={() => {
              setActiveDetailTab('conversation');
              setOriginalRequest(null);
              setOriginalViewer(null);
            }}
            type="button"
          >
            메시지 상세
          </button>
          <BreadcrumbSeparator />
          {originalViewer ? (
            <>
              <button
                onClick={closeOriginalViewer}
                type="button"
              >
                {originalViewer.source === 'replyComposer'
                  ? '답변 작성하기'
                  : detailTabLabel[activeDetailTab]}
              </button>
              <BreadcrumbSeparator />
              <strong>원문 열람</strong>
            </>
          ) : (
            <strong>{detailTabLabel[activeDetailTab]}</strong>
          )}
        </nav>
      </header>

      <nav aria-label="메시지 상세 탭" className="board-detail-tabs">
        {detailTabs.map((tab) => (
          <button
            aria-current={activeDetailTab === tab ? 'page' : undefined}
            className={activeDetailTab === tab ? 'is-active' : ''}
            key={tab}
            onClick={() => {
              setActiveDetailTab(tab);
              setOriginalRequest(null);
              setOriginalViewer(null);
            }}
            type="button"
          >
            {detailTabLabel[tab]}
          </button>
        ))}
      </nav>

      <div className="board-parent-card">
        <div className="board-card-profile">
          <ProfileAvatar />
          <span>
            <strong>{thread.parentName}</strong>
            <small>{thread.className}</small>
          </span>
        </div>
        <div className="board-card-topic">
          <strong>{thread.title}</strong>
          <span>{thread.latestMessage}</span>
        </div>
        <div className="board-card-meta-group">
          <div className="board-card-meta">
            <span>위험도</span>
            <Badge
              className={`board-risk-badge board-risk-${thread.risk}`}
              size="sm"
              variant={riskVariant[thread.risk]}
            >
              {riskLabel[thread.risk]}
            </Badge>
          </div>
          <div className="board-card-meta">
            <span>최근 수신</span>
            <time dateTime={thread.latestAt}>{thread.latestAtLabel}</time>
          </div>
        </div>
      </div>

      {originalViewer ? (
        <OriginalMessageViewer
          selectedEvidence={originalViewer.evidence}
          thread={thread}
        />
      ) : null}

      {!originalViewer && activeDetailTab === 'conversation' ? (
        <>
          <div className="board-info-box">
            <span aria-hidden="true">i</span>
            <p>{conversationInfoText}</p>
          </div>

          <div
            className={`board-conversation${
              showBufferedSummaryOnly ? ' is-summary-only' : ''
            }`}
            aria-label="게시글 답글 스레드"
          >
        <div className="board-date-chip">
          <svg
            aria-hidden="true"
            fill="none"
            viewBox="0 0 18 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M2 20c-.55 0-1.021-.196-1.412-.588A1.926 1.926 0 0 1 0 18V4c0-.55.196-1.02.588-1.412A1.926 1.926 0 0 1 2 2h1V0h2v2h8V0h2v2h1c.55 0 1.02.196 1.412.588C17.804 2.979 18 3.45 18 4v14c0 .55-.196 1.02-.588 1.412A1.926 1.926 0 0 1 16 20H2Zm0-2h14V8H2v10Zm0-12h14V4H2v2Zm7 6a.967.967 0 0 1-.713-.288A.967.967 0 0 1 8 11c0-.283.096-.52.287-.712A.967.967 0 0 1 9 10c.283 0 .52.096.713.288.191.191.287.429.287.712 0 .283-.096.52-.287.712A.967.967 0 0 1 9 12Zm-4 0a.967.967 0 0 1-.713-.288A.967.967 0 0 1 4 11c0-.283.096-.52.287-.712A.967.967 0 0 1 5 10c.283 0 .52.096.713.288.191.191.287.429.287.712 0 .283-.096.52-.287.712A.967.967 0 0 1 5 12Zm8 0a.967.967 0 0 1-.713-.288A.967.967 0 0 1 12 11c0-.283.096-.52.287-.712A.967.967 0 0 1 13 10c.283 0 .52.096.713.288.191.191.287.429.287.712 0 .283-.096.52-.287.712A.967.967 0 0 1 13 12Zm-4 4a.967.967 0 0 1-.713-.288A.967.967 0 0 1 8 15c0-.283.096-.52.287-.712A.967.967 0 0 1 9 14c.283 0 .52.096.713.288.191.191.287.429.287.712 0 .283-.096.52-.287.712A.967.967 0 0 1 9 16Zm-4 0a.967.967 0 0 1-.713-.288A.967.967 0 0 1 4 15c0-.283.096-.52.287-.712A.967.967 0 0 1 5 14c.283 0 .52.096.713.288.191.191.287.429.287.712 0 .283-.096.52-.287.712A.967.967 0 0 1 5 16Zm8 0a.967.967 0 0 1-.713-.288A.967.967 0 0 1 12 15c0-.283.096-.52.287-.712A.967.967 0 0 1 13 14c.283 0 .52.096.713.288.191.191.287.429.287.712 0 .283-.096.52-.287.712A.967.967 0 0 1 13 16Z"
              fill="currentColor"
            />
          </svg>
          <span>{thread.messageDateLabel ?? '2026년 8월 10일 월요일'}</span>
        </div>

        {bufferedSummaryText ? (
          <article className="board-moderation-message">
            <div className="board-reply-author">
              <ProfileAvatar className="board-mini-avatar" />
              <strong>{thread.parentName}</strong>
            </div>
            <div className="board-moderation-row">
              <div className="board-moderation-card">
                <div>
                  <strong className="board-moderation-title">
                    <svg
                      aria-hidden="true"
                      fill="none"
                      viewBox="0 0 18 23"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M9 13.5681c-.15742 0-.2661.0474-.35938.1406C8.54735 13.802 8.5 13.9107 8.5 14.0681c0 .1574.04735.2661.14062.3594.09328.0933.20196.1406.35938.1406s.2661-.0473.35938-.1406c.09326-.0933.14062-.202.14062-.3594 0-.1574-.04735-.2661-.14062-.3594-.09328-.0932-.20196-.1406-.35938-.1406Zm-.5-3h1v-4h-1v4Zm9-0.4004c0 2.6404-.7888 5.0478-2.3584 7.2071-1.5717 2.162-3.5807 3.5646-6.01953 4.1787L9 21.5837l-.12207-.0302c-2.43885-.6141-4.44784-2.0167-6.01953-4.1787C1.2888 15.2155.5 12.8081.5 10.1677V3.72144l.324219-.1211 8-3L9 .533936l.17578.066406 8 3 .32422.121098v6.44626Z"
                        fill="currentColor"
                        stroke="white"
                      />
                    </svg>
                    <span>위험 메시지 완충 요약</span>
                  </strong>
                  <p>{bufferedSummaryText}</p>
                </div>
                <div className="board-moderation-actions">
                  <button
                    disabled={!canInspectOriginal}
                    onClick={() => openOriginalViewer()}
                    type="button"
                  >
                    원문 보기
                  </button>
                  <button
                    onClick={() => setActiveDetailTab('risk')}
                    type="button"
                  >
                    판단 근거
                  </button>
                </div>
              </div>
              <time>{thread.replies[0]?.time ?? thread.latestAtLabel}</time>
            </div>
          </article>
        ) : null}

        {visibleConversationReplies.map((reply) => (
          <article
            className={`board-reply board-reply-${reply.authorRole}`}
            key={reply.id}
          >
            <div className="board-reply-author">
              <ProfileAvatar className="board-mini-avatar" />
              <strong>{reply.authorName}</strong>
            </div>
            <div className="board-reply-row">
              {reply.authorRole === 'teacher' ? (
                <div className="board-reply-time">
                  {reply.readByParent ? <span>1</span> : null}
                  <time>{reply.time}</time>
                </div>
              ) : null}
              <div className="board-reply-bubble">
                <span>{reply.label}</span>
                <p>{reply.content}</p>
              </div>
              {reply.authorRole === 'parent' ? <time>{reply.time}</time> : null}
            </div>
          </article>
        ))}
        <div className={`board-answer-box${isLocked ? ' is-locked' : ''}`}>
          {isLocked ? (
            <>
              <div className="board-lock-message">
                <span className="board-lock-icon" aria-hidden="true">
                  <svg
                    fill="none"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle cx="10" cy="10" fill="#FF4B6C" r="10" />
                    <path
                      d="M7 15c-.275 0-.51042-.0933-.70625-.2798C6.09792 14.5337 6 14.3095 6 14.0476V9.28571c0-.2619.09792-.48611.29375-.67261.19583-.18651.43125-.27977.70625-.27977h.5v-.95238c0-.65873.24375-1.22024.73125-1.68452C8.71875 5.23214 9.30833 5 10 5c.6917 0 1.2812.23214 1.7688.69643.4874.46428.7312 1.02579.7312 1.68452v.95238h.5c.275 0 .5104.09326.7063.27977.1958.1865.2937.41071.2937.67261v4.76189c0 .2619-.0979.4861-.2937.6726C13.5104 14.9067 13.275 15 13 15H7Zm3.7063-2.6607c.1958-.1865.2937-.4107.2937-.6726 0-.2619-.0979-.4861-.2937-.6727-.1959-.1865-.4313-.2797-.7063-.2797-.275 0-.51042.0932-.70625.2797C9.09792 11.1806 9 11.4048 9 11.6667c0 .2619.09792.4861.29375.6726.19583.1865.43125.2797.70625.2797.275 0 .5104-.0932.7063-.2797ZM8.5 8.33333h3v-.95238c0-.39682-.1458-.73412-.4375-1.0119-.2917-.27778-.6458-.41667-1.0625-.41667-.41667 0-.77083.13889-1.0625.41667C8.64583 6.64683 8.5 6.98413 8.5 7.38095v.95238Z"
                      fill="white"
                    />
                  </svg>
                </span>
                <div>
                  <strong>{lockedGuide.lockTitle}</strong>
                  <p>{lockedGuide.lockDescription}</p>
                </div>
              </div>
              <button
                className="board-outline-button board-risk-review-button"
                onClick={() => setActiveDetailTab('risk')}
                type="button"
              >
                <svg
                  aria-hidden="true"
                  fill="none"
                  viewBox="0 0 18 19"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M2 16.8889h1.425L13.2 6.57083l-1.425-1.50416L2 15.3847v1.5042ZM0 19v-4.4861L13.2.606944c.2-.193518.4208-.343055.6625-.448611C14.1042.052778 14.3583 0 14.625 0c.2667 0 .525.052778.775.158333.25.105556.4667.263889.65.475l1.375 1.477777c.2.19352.3458.42222.4375.68611.0917.26389.1375.52778.1375.79167 0 .28148-.0458.54977-.1375.80486-.0917.25509-.2375.48819-.4375.69931L4.25 19H0ZM12.475 5.83194l-.7-.76527L13.2 6.57083l-.725-.73889Z"
                    fill="currentColor"
                  />
                </svg>
                <span>위험도 검토 바로가기</span>
              </button>
            </>
          ) : (
            <>
              <div className="board-answer-cta-copy">
                <strong>답변 작성이 필요합니다.</strong>
                <p>
                  학부모 메시지와 위험 요소를 확인한 뒤 답변 작성 도우미에서
                  초안을 다듬을 수 있습니다.
                </p>
              </div>
              <div className="board-answer-actions board-answer-actions--cta">
                <button
                  className="board-primary-button board-reply-compose-button"
                  onClick={() => onOpenReplyComposer(thread.id)}
                  type="button"
                >
                  {hasDraft ? '답변 이어서 작성하기' : '답변 작성하러 가기'}
                </button>
              </div>
            </>
          )}
          </div>
          </div>
        </>
      ) : null}

      {!originalViewer && activeDetailTab === 'risk' ? (
        <RiskAnalysisPanel
          onEvidencePackageCreate={onEvidencePackageCreate}
          onReviewComplete={onReviewComplete}
          onOriginalOpen={openOriginalViewer}
          onReviewRequest={onReviewRequest}
          thread={thread}
        />
      ) : null}

      {!originalViewer && activeDetailTab === 'activity' ? (
        <ActivityLogPanel thread={thread} />
      ) : null}

      <OriginalMessageConfirmDialog
        onCancel={() => setOriginalRequest(null)}
        onConfirm={confirmOriginalViewer}
        open={originalRequest !== null}
      />
    </section>
  );
}

function SparkleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M10.62 1.5L12.1 6.1L16.7 7.58L12.1 9.06L10.62 13.66L9.14 9.06L4.54 7.58L9.14 6.1L10.62 1.5ZM4.1 11.64L4.9 14.1L7.36 14.9L4.9 15.7L4.1 18.16L3.3 15.7L0.84 14.9L3.3 14.1L4.1 11.64ZM15.84 12.08L16.48 14.08L18.5 14.72L16.48 15.36L15.84 17.38L15.2 15.36L13.18 14.72L15.2 14.08L15.84 12.08Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ResetIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M10 18C7.77 18 5.88 17.23 4.33 15.68C2.78 14.13 2 12.24 2 10C2 7.76 2.78 5.87 4.33 4.32C5.88 2.77 7.77 2 10 2C11.25 2 12.43 2.28 13.52 2.84C14.61 3.39 15.51 4.18 16.22 5.2V2.8H18V8.44H12.36V6.66H15.16C14.61 5.76 13.89 5.05 13 4.54C12.11 4.03 11.11 3.78 10 3.78C8.27 3.78 6.8 4.38 5.6 5.59C4.39 6.8 3.78 8.27 3.78 10C3.78 11.73 4.39 13.2 5.6 14.41C6.8 15.62 8.27 16.22 10 16.22C11.34 16.22 12.55 15.84 13.62 15.08C14.69 14.32 15.44 13.33 15.88 12.1H17.76C17.28 13.84 16.31 15.26 14.86 16.36C13.41 17.45 11.79 18 10 18Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SendIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M11.3137 19.092L7.07107 14.8494L11.3137 7.77832L4.24264 12.021L0 7.77832L19.0919 0.000145853L11.3137 19.092Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SaveIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M18 4V16C18 16.55 17.8042 17.0208 17.4125 17.4125C17.0208 17.8042 16.55 18 16 18H2C1.45 18 0.979167 17.8042 0.5875 17.4125C0.195833 17.0208 0 16.55 0 16V2C0 1.45 0.195833 0.979167 0.5875 0.5875C0.979167 0.195833 1.45 0 2 0H14L18 4ZM11.125 14.125C11.7083 13.5417 12 12.8333 12 12C12 11.1667 11.7083 10.4583 11.125 9.875C10.5417 9.29167 9.83333 9 9 9C8.16667 9 7.45833 9.29167 6.875 9.875C6.29167 10.4583 6 11.1667 6 12C6 12.8333 6.29167 13.5417 6.875 14.125C7.45833 14.7083 8.16667 15 9 15C9.83333 15 10.5417 14.7083 11.125 14.125ZM3 7H12V3H3V7Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CheckCircleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M12 22C10.62 22 9.33 21.74 8.12 21.21C6.91 20.68 5.86 19.97 4.96 19.07C4.06 18.17 3.35 17.12 2.82 15.91C2.29 14.7 2.03 13.4 2.03 12.03C2.03 10.65 2.29 9.36 2.82 8.15C3.35 6.94 4.06 5.89 4.96 4.99C5.86 4.09 6.91 3.38 8.12 2.85C9.33 2.32 10.62 2.06 12 2.06C13.38 2.06 14.67 2.32 15.88 2.85C17.09 3.38 18.14 4.09 19.04 4.99C19.94 5.89 20.65 6.94 21.18 8.15C21.71 9.36 21.97 10.65 21.97 12.03C21.97 13.4 21.71 14.7 21.18 15.91C20.65 17.12 19.94 18.17 19.04 19.07C18.14 19.97 17.09 20.68 15.88 21.21C14.67 21.74 13.38 22 12 22ZM10.98 15.55L17.05 9.48L15.64 8.07L10.98 12.73L8.36 10.11L6.95 11.52L10.98 15.55Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CheckPointIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 25 25"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect width="25" height="25" rx="8" fill="#F8F8F8" />
      <path
        d="M6 19V7.3C6 6.9425 6.12729 6.63646 6.38187 6.38187C6.63646 6.12729 6.9425 6 7.3 6H17.7C18.0575 6 18.3635 6.12729 18.6181 6.38187C18.8727 6.63646 19 6.9425 19 7.3V15.1C19 15.4575 18.8727 15.7635 18.6181 16.0181C18.3635 16.2727 18.0575 16.4 17.7 16.4H8.6L6 19ZM12.5 14.45C12.6842 14.45 12.8385 14.3877 12.9631 14.2631C13.0877 14.1385 13.15 13.9842 13.15 13.8C13.15 13.6158 13.0877 13.4615 12.9631 13.3369C12.8385 13.2123 12.6842 13.15 12.5 13.15C12.3158 13.15 12.1615 13.2123 12.0369 13.3369C11.9123 13.4615 11.85 13.6158 11.85 13.8C11.85 13.9842 11.9123 14.1385 12.0369 14.2631C12.1615 14.3877 12.3158 14.45 12.5 14.45ZM11.85 11.85H13.15V7.95H11.85V11.85Z"
        fill="currentColor"
      />
    </svg>
  );
}

function WritingGuideIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 25 25"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect width="25" height="25" rx="8" fill="#F8F8F8" />
      <path
        d="M9.66667 15.5H11V6.5H9.66667V15.5ZM9 20C8.44444 20 7.97222 19.7813 7.58333 19.3438C7.19444 18.9063 7 18.375 7 17.75V7.25C7 6.625 7.19444 6.09375 7.58333 5.65625C7.97222 5.21875 8.44444 5 9 5H16.3333V17H9C8.81111 17 8.65278 17.0719 8.525 17.2156C8.39722 17.3594 8.33333 17.5375 8.33333 17.75C8.33333 17.9625 8.39722 18.1406 8.525 18.2844C8.65278 18.4281 8.81111 18.5 9 18.5H17.6667V6.5H19V20H9Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ReferenceBookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 25 25"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect width="25" height="25" rx="8" fill="#F8F8F8" />
      <path
        d="M13 19C12.4182 18.5074 11.7879 18.125 11.1091 17.8528C10.4303 17.5806 9.72727 17.4444 9 17.4444C8.49091 17.4444 7.99091 17.5157 7.5 17.6583C7.00909 17.8009 6.53939 18.0019 6.09091 18.2611C5.83636 18.4037 5.59091 18.3972 5.35455 18.2417C5.11818 18.0861 5 17.8593 5 17.5611V8.18889C5 8.0463 5.03333 7.91019 5.1 7.78056C5.16667 7.65093 5.26667 7.5537 5.4 7.48889C5.95758 7.17778 6.53939 6.94444 7.14545 6.78889C7.75152 6.63333 8.3697 6.55556 9 6.55556C9.89697 6.55556 10.6606 6.66574 11.2909 6.88611C11.9212 7.10648 12.6 7.44352 13.3273 7.89722C13.4606 7.975 13.5606 8.06574 13.6273 8.16944C13.6939 8.27315 13.7273 8.40926 13.7273 8.57778V16.7056C14.2606 16.4333 14.797 16.2292 15.3364 16.0931C15.8758 15.9569 16.4303 15.8889 17 15.8889C17.4364 15.8889 17.8636 15.9278 18.2818 16.0056C18.7 16.0833 19.1212 16.2 19.5455 16.3556V7.00278C19.7273 7.06759 19.9061 7.13889 20.0818 7.21667C20.2576 7.29444 20.4303 7.38519 20.6 7.48889C20.7333 7.5537 20.8333 7.65093 20.9 7.78056C20.9667 7.91019 21 8.0463 21 8.18889V17.5611C21 17.8593 20.8818 18.0861 20.6455 18.2417C20.4091 18.3972 20.1636 18.4037 19.9091 18.2611C19.4606 18.0019 18.9909 17.8009 18.5 17.6583C18.0091 17.5157 17.5091 17.4444 17 17.4444C16.2727 17.4444 15.5697 17.5806 14.8909 17.8528C14.2121 18.125 13.5818 18.5074 13 19ZM15.5455 14.3333V5.77778L17.7273 5V13.5556L15.5455 14.3333Z"
        fill="currentColor"
      />
    </svg>
  );
}

type ReplySendConfirmDialogProps = {
  draftText: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  thread: BoardThread;
};

function ReplySendConfirmDialog({
  draftText,
  onCancel,
  onConfirm,
  open,
  thread,
}: ReplySendConfirmDialogProps) {
  const [isConfirmed, setIsConfirmed] = useState(false);

  useEffect(() => {
    if (open) {
      setIsConfirmed(false);
    }
  }, [draftText, open, thread.id]);

  return (
    <Modal
      className="board-send-confirm-modal"
      closeOnOverlayClick={false}
      description="최종 전송 전 교사가 직접 내용을 확인해야 합니다."
      footer={
        <>
          <Button onClick={onCancel} variant="outline">
            취소
          </Button>
          <Button
            disabled={!isConfirmed}
            leftIcon={<SendIcon />}
            onClick={onConfirm}
          >
            최종 전송
          </Button>
        </>
      }
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onCancel();
        }
      }}
      open={open}
      title="답변 전 확인"
    >
      <div className="board-send-confirm">
        <div className="board-send-confirm-summary">
          <span>{thread.parentName}</span>
          <strong>{thread.title}</strong>
        </div>
        <div className="board-send-confirm-preview">
          <strong>전송될 답변</strong>
          <p>{draftText}</p>
        </div>
        <label className="board-send-confirm-checkbox">
          <input
            checked={isConfirmed}
            onChange={(event) => setIsConfirmed(event.currentTarget.checked)}
            type="checkbox"
          />
          <span>
            AI 초안을 포함한 답변 내용을 직접 확인했고 필요한 수정을 마쳤습니다.
          </span>
        </label>
      </div>
    </Modal>
  );
}

type ReplySendCompleteDialogProps = {
  onClose: () => void;
  open: boolean;
  thread?: BoardThread | null;
};

function ReplySendCompleteDialog({
  onClose,
  open,
  thread,
}: ReplySendCompleteDialogProps) {
  return (
    <Modal
      className="board-reply-complete-modal"
      footer={<Button onClick={onClose}>확인</Button>}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
      open={open}
      size="sm"
      title="답변 전송 완료"
    >
      <div className="board-reply-complete">
        <CheckCircleIcon />
        <p>
          {thread?.parentName ?? '학부모'}에게 답변을 전송했습니다.
          <br />
          대화 상태가 상담 완료로 변경되었습니다.
        </p>
      </div>
    </Modal>
  );
}

type ReplyComposerPageProps = {
  onApplyOfficialTemplate: (threadId: string) => void;
  onBack: () => void;
  onDraftChange: (threadId: string, value: string) => void;
  onDraftReset: (threadId: string) => void;
  onDraftSave: (threadId: string) => void;
  onGenerateAiDraft: (threadId: string) => void;
  onListOpen: () => void;
  onOpenOriginalPage: (threadId: string) => void;
  onSubmitReply: (threadId: string) => void;
  thread: BoardThread;
};

function ReplyComposerPage({
  onApplyOfficialTemplate,
  onBack,
  onDraftChange,
  onDraftReset,
  onDraftSave,
  onGenerateAiDraft,
  onListOpen,
  onOpenOriginalPage,
  onSubmitReply,
  thread,
}: ReplyComposerPageProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isCheckPanelOpen, setIsCheckPanelOpen] = useState(true);
  const [isOriginalConfirmOpen, setIsOriginalConfirmOpen] = useState(false);
  const hasDraft = thread.draftText.trim().length > 0;
  const bufferedSummaryText = getBufferedSummaryText(thread);
  const isLocked = isReplyLocked(thread);
  const riskLevel = getThreadRiskLevel(thread);
  const isAiDraftAvailable = canGenerateReplyDraft(thread);
  const isOfficialTemplateAvailable = canUseOfficialReplyTemplate(thread);
  const lockNoticeId = `board-reply-lock-notice-${thread.id}`;
  const aiNoticeId = `board-ai-draft-notice-${thread.id}`;
  const replyTextareaDescription = [isLocked ? lockNoticeId : undefined, aiNoticeId]
    .filter(Boolean)
    .join(' ');
  const canInspectOriginal = Boolean(
    thread.analysis?.canViewOriginal &&
      thread.analysis.originalMessageAvailable &&
      thread.originalMessage,
  );
  const isBufferedContext = riskLevel !== 'low' && Boolean(bufferedSummaryText);
  const contextMessageText = isBufferedContext
    ? (bufferedSummaryText ?? getPrimaryParentMessage(thread))
    : getPrimaryParentMessage(thread);
  const shouldShowOriginalButton = riskLevel !== 'low' && canInspectOriginal;
  const assistButtonLabel = isOfficialTemplateAvailable
    ? thread.officialTemplateApplied
      ? '템플릿 다시 적용'
      : '공식 템플릿 적용'
    : thread.aiDraftGenerated
      ? 'AI 다시 생성'
      : 'AI 답변 생성';
  const assistButtonDisabled =
    isLocked || (!isAiDraftAvailable && !isOfficialTemplateAvailable);
  const stageNotice =
    riskLevel === 'low'
      ? '일반 단계: 원문과 RAG 기반 참고자료로 답변 초안을 생성할 수 있습니다.'
      : riskLevel === 'medium'
        ? '주의 단계: 완충 요약과 원문을 확인한 뒤 AI 초안을 교사가 검토하고 수정하는 것을 권고합니다.'
        : riskLevel === 'high'
          ? '위험 단계: 개별 AI 초안 대신 증빙 패키지와 승인된 공식 응답 템플릿을 사용합니다.'
          : '긴급 단계: 개별 답변 초안은 제공되지 않으며 즉시 오프라인 공식 절차에 따라 대응합니다.';
  const draftStatusText = isLocked
    ? '위험도 검토 필요'
    : thread.draftSavedAt
      ? `마지막 임시저장 ${thread.draftSavedAt}`
      : thread.officialTemplateApplied
        ? '공식 템플릿 적용됨'
        : thread.aiDraftGenerated
          ? 'AI 초안 적용됨'
          : hasDraft
            ? '작성 중'
            : '작성 중인 답변 없음';
  const handleAssistAction = () => {
    if (isOfficialTemplateAvailable) {
      onApplyOfficialTemplate(thread.id);
      return;
    }

    if (isAiDraftAvailable) {
      onGenerateAiDraft(thread.id);
    }
  };
  const requestOriginalOpen = () => {
    if (!canInspectOriginal) {
      return;
    }

    setIsOriginalConfirmOpen(true);
  };

  useEffect(() => {
    setIsConfirmOpen(false);
    setIsCheckPanelOpen(true);
    setIsOriginalConfirmOpen(false);
  }, [thread.id]);

  return (
    <section className="board-detail" aria-labelledby="board-composer-title">
      <header className="board-detail-page-header">
        <div className="board-detail-title-group">
          <button
            aria-label="메시지 상세로 돌아가기"
            className="board-back-button"
            onClick={onBack}
            type="button"
          >
            <svg
              aria-hidden="true"
              fill="none"
              viewBox="0 0 16 15"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3.825 8.24079 9.425 13.3684 8 14.6503 0 7.32515 8 0l1.425 1.2819-5.6 5.1276H16v1.83129H3.825Z"
                fill="currentColor"
              />
            </svg>
          </button>
          <h1 id="board-composer-title">답변 작성하기</h1>
        </div>

        <nav aria-label="현재 위치" className="board-page-nav">
          <button onClick={onListOpen} type="button">
            홈
          </button>
          <BreadcrumbSeparator />
          <button onClick={onListOpen} type="button">
            메시지
          </button>
          <BreadcrumbSeparator />
          <button onClick={onBack} type="button">
            메시지 상세
          </button>
          <BreadcrumbSeparator />
          <button onClick={onBack} type="button">
            대화
          </button>
          <BreadcrumbSeparator />
          <strong>답변 작성하기</strong>
        </nav>
      </header>

      <div className="board-parent-card">
        <div className="board-card-profile">
          <ProfileAvatar />
          <span>
            <strong>{thread.parentName}</strong>
            <small>{thread.className}</small>
          </span>
        </div>
        <div className="board-card-topic">
          <strong>{thread.title}</strong>
          <span>{thread.latestMessage}</span>
        </div>
        <div className="board-card-meta-group">
          <div className="board-card-meta">
            <span>위험도</span>
            <Badge
              className={`board-risk-badge board-risk-${thread.risk}`}
              size="sm"
              variant={riskVariant[thread.risk]}
            >
              {riskLabel[thread.risk]}
            </Badge>
          </div>
          <div className="board-card-meta">
            <span>최근 수신</span>
            <time dateTime={thread.latestAt}>{thread.latestAtLabel}</time>
          </div>
        </div>
      </div>

      <div className="board-reply-composer board-ai-reply-composer">
        <section
          className={`board-reply-check-panel${
            isCheckPanelOpen ? ' is-open' : ''
          }`}
        >
          <div className="board-reply-check-heading">
            <div className="board-reply-check-alert">
              <ReplyCheckAlertIcon />
              <p>답변 전 확인이 필요한 내용을 확인해 주세요.</p>
            </div>
            <button
              aria-expanded={isCheckPanelOpen}
              className="board-reply-check-toggle"
              onClick={() => setIsCheckPanelOpen((isOpen) => !isOpen)}
              type="button"
            >
              <span>{isCheckPanelOpen ? '접기' : '자세히 보기'}</span>
              <svg
                aria-hidden="true"
                className={isCheckPanelOpen ? 'is-open' : ''}
                fill="none"
                viewBox="0 0 13 7"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M0 1.0552L1.15375 0L6.5 4.8896L11.8463 0L13 1.0552L6.5 7L0 1.0552Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>

          {isCheckPanelOpen ? (
            <div className="board-reply-check-content">
              <article>
                <span>
                  <CheckPointIcon />
                  <strong>주의 포인트</strong>
                </span>
                <p>
                  <span>추측 또는 단정적인 표현은 피하세요.</span>
                  <span>내용을 충분히 검토한 뒤 전송해주세요.</span>
                </p>
              </article>
              <article>
                <span>
                  <WritingGuideIcon />
                  <strong>답변 작성 가이드</strong>
                </span>
                <p>
                  <span>사실로 확인되지 않은 내용은 단정하지 마세요.</span>
                  <span>향후 진행 조치와 확인 절차를 명확히 설명하세요.</span>
                  <span>상담 가능한 일정(시간)을 제안하세요.</span>
                </p>
              </article>
              <article>
                <span>
                  <ReferenceBookIcon />
                  <strong>관련 규정 및 근거</strong>
                </span>
                <div className="board-reply-check-reference">
                  <p>
                    <span>제3조(상담 운영 시간), 제4조(상담 신청)</span>
                  </p>
                  <button
                    className="board-outline-button board-risk-action-button board-reply-check-reference-button"
                    onClick={() => {
                      openGuidePostFromMessages(
                        thread.id,
                        'reply',
                        replyReferenceGuidePostId,
                      );
                    }}
                    type="button"
                  >
                    <span>자세히 보기</span>
                    <ExternalLinkIcon />
                  </button>
                </div>
              </article>
            </div>
          ) : null}
        </section>

        <section className="board-reply-context-panel board-reply-context-panel--compact">
          <div className="board-reply-context-heading">
            <h2>{isBufferedContext ? '완충 요약' : '학부모 메시지'}</h2>
            {shouldShowOriginalButton ? (
              <button
                className="board-reference-button"
                disabled={!canInspectOriginal}
                onClick={requestOriginalOpen}
                type="button"
              >
                <OriginalViewerIcon />
                <span>원문 보기</span>
              </button>
            ) : null}
          </div>
          <p>{contextMessageText}</p>
        </section>

        <section className="board-reply-compose-panel board-reply-compose-panel--ai">
          <div className="board-reply-compose-header">
            <label htmlFor="board-reply-composer-input">선생님 답변</label>
            <span aria-live="polite">{draftStatusText}</span>
          </div>
          {isLocked ? (
            <p className="board-reply-lock-notice" id={lockNoticeId}>
              긴급 위험도 검토가 필요한 메시지는 위험 요소 탭에서 검토를
              완료한 뒤 답변을 전송할 수 있습니다.
            </p>
          ) : null}
          <textarea
            aria-describedby={replyTextareaDescription || undefined}
            disabled={isLocked}
            id="board-reply-composer-input"
            onChange={(event) => onDraftChange(thread.id, event.target.value)}
            placeholder="학부모에게 전달할 답변을 작성하세요."
            rows={11}
            value={thread.draftText}
          />
          <p className="board-reply-ai-note" id={aiNoticeId}>
            {stageNotice}
            <br />
            생성되거나 적용된 답변은 자동 전송되지 않으며, 교사가 직접 수정한
            내용만 최종 전송됩니다.
          </p>
          <div className="board-reply-bottom-actions">
            <button
              className="board-composer-action-button"
              disabled={isLocked || !hasDraft}
              onClick={() => onDraftSave(thread.id)}
              type="button"
            >
              <SaveIcon />
              <span>임시저장</span>
            </button>
            <div className="board-composer-action-group">
              <button
                className="board-composer-action-button"
                disabled={assistButtonDisabled}
                onClick={handleAssistAction}
                type="button"
              >
                {isOfficialTemplateAvailable ? (
                  <WritingGuideIcon />
                ) : (
                  <SparkleIcon />
                )}
                <span>{assistButtonLabel}</span>
              </button>
              <button
                className="board-composer-action-button"
                disabled={isLocked || !hasDraft}
                onClick={() => onDraftReset(thread.id)}
                type="button"
              >
                <ResetIcon />
                <span>초기화</span>
              </button>
              <button
                aria-describedby={isLocked ? lockNoticeId : undefined}
                className="board-composer-action-button board-composer-action-button--primary"
                disabled={isLocked || !hasDraft}
                onClick={() => setIsConfirmOpen(true)}
                type="button"
              >
                <SendIcon />
                <span>검토 후 전송</span>
              </button>
            </div>
          </div>
        </section>
      </div>

      <ReplySendConfirmDialog
        draftText={thread.draftText.trim()}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={() => {
          setIsConfirmOpen(false);
          onSubmitReply(thread.id);
        }}
        open={isConfirmOpen}
        thread={thread}
      />
      <OriginalMessageConfirmDialog
        onCancel={() => setIsOriginalConfirmOpen(false)}
        onConfirm={() => {
          setIsOriginalConfirmOpen(false);
          onOpenOriginalPage(thread.id);
        }}
        open={isOriginalConfirmOpen}
      />
    </section>
  );
}

export function TeacherMessages({
  initialThreadId = null,
  initialView = null,
}: TeacherMessagesProps) {
  const initialMessagesRouteState = getMessagesRouteStateFromLocation({
    initialThreadId,
    initialView,
  });
  const [activeFilter, setActiveFilter] = useState<FilterValue>('all');
  const [activeTab, setActiveTab] = useState<ThreadTab>('all');
  const [draftPromptThreadId, setDraftPromptThreadId] = useState<string | null>(
    null,
  );
  const [initialDetailTabRequest, setInitialDetailTabRequest] = useState<{
    tab: DetailTab;
    threadId: string;
  } | null>(null);
  const [initialOriginalViewerRequest, setInitialOriginalViewerRequest] =
    useState<{
      request: OriginalMessageRequest;
      threadId: string;
    } | null>(null);
  const [query, setQuery] = useState('');
  const [replyComposerThreadId, setReplyComposerThreadId] = useState<
    string | null
  >(
    initialMessagesRouteState.view === 'reply'
      ? initialMessagesRouteState.threadId
      : null,
  );
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    initialMessagesRouteState.threadId,
  );
  const [sendCompleteThreadId, setSendCompleteThreadId] = useState<string | null>(
    null,
  );
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [threads, setThreads] = useState(initialThreads);

  const syncRouteState = useCallback(
    (routeState: {
      threadId: string | null;
      view: MessagesRouteView | null;
    }) => {
      setDraftPromptThreadId(null);
      setInitialDetailTabRequest(null);
      setInitialOriginalViewerRequest(null);
      setReplyComposerThreadId(
        routeState.view === 'reply' ? routeState.threadId : null,
      );
      setSelectedThreadId(routeState.threadId);
      setSendCompleteThreadId(null);
    },
    [],
  );

  useEffect(() => {
    syncRouteState(
      getMessagesRouteStateFromLocation({ initialThreadId, initialView }),
    );
  }, [initialThreadId, initialView, syncRouteState]);

  useEffect(() => {
    const handlePopState = () => {
      syncRouteState(getMessagesRouteStateFromLocation({}));
    };

    window.addEventListener('popstate', handlePopState);

    return () => window.removeEventListener('popstate', handlePopState);
  }, [syncRouteState]);

  const filteredThreads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return threads.filter((thread) => {
      const matchesFilter =
        activeFilter === 'all' ||
        (activeFilter === 'active' && thread.status !== 'complete') ||
        (activeFilter === 'complete' && thread.status === 'complete');
      const searchableText = [
        thread.parentName,
        thread.studentName,
        thread.className,
        thread.title,
        thread.latestMessage,
        statusLabel[thread.status],
      ]
        .join(' ')
        .toLowerCase();
      const matchesQuery =
        normalizedQuery.length === 0 ||
        searchableText.includes(normalizedQuery);

      return matchesFilter && matchesQuery;
    });
  }, [activeFilter, query, threads]);

  const starredThreads = filteredThreads.filter((thread) => thread.isPinned);
  const draftThreads = filteredThreads.filter(
    (thread) => thread.draftText.trim().length > 0,
  );
  const selectedThread =
    threads.find((thread) => thread.id === selectedThreadId) ?? null;
  const replyComposerThread =
    threads.find((thread) => thread.id === replyComposerThreadId) ?? null;
  const draftPromptThread =
    threads.find((thread) => thread.id === draftPromptThreadId) ?? null;
  const sendCompleteThread =
    threads.find((thread) => thread.id === sendCompleteThreadId) ?? null;

  const updateThread = (
    threadId: string,
    updater: (thread: BoardThread) => BoardThread,
  ) => {
    setThreads((currentThreads) =>
      currentThreads.map((thread) =>
        thread.id === threadId ? updater(thread) : thread,
      ),
    );
  };

  const handleToggleStar = (threadId: string) => {
    updateThread(threadId, (thread) => ({
      ...thread,
      isPinned: !thread.isPinned,
    }));
  };

  const handleSelectThread = (threadId: string) => {
    const thread = threads.find((currentThread) => currentThread.id === threadId);
    setInitialDetailTabRequest(null);
    setInitialOriginalViewerRequest(null);
    setReplyComposerThreadId(null);

    if (thread?.draftText.trim()) {
      setDraftPromptThreadId(threadId);
      return;
    }

    setSelectedThreadId(threadId);
    pushTeacherMessageRoute(threadId, 'detail');
  };

  const handleContinueDraft = () => {
    const thread = threads.find(
      (currentThread) => currentThread.id === draftPromptThreadId,
    );

    if (thread) {
      setSelectedThreadId(thread.id);
      setInitialOriginalViewerRequest(null);

      if (isReplyLocked(thread)) {
        setInitialDetailTabRequest({ tab: 'risk', threadId: thread.id });
        setReplyComposerThreadId(null);
        pushTeacherMessageRoute(thread.id, 'detail');
      } else {
        setInitialDetailTabRequest(null);
        setReplyComposerThreadId(thread.id);
        pushTeacherMessageRoute(thread.id, 'reply');
      }
    }

    setDraftPromptThreadId(null);
  };

  const handleDraftChange = (threadId: string, value: string) => {
    updateThread(threadId, (thread) => ({
      ...thread,
      aiDraftGenerated: value.trim() ? thread.aiDraftGenerated : false,
      draftSavedAt: value.trim() ? thread.draftSavedAt : undefined,
      officialTemplateApplied: value.trim()
        ? thread.officialTemplateApplied
        : false,
      draftText: value,
      status: thread.status === 'complete' ? 'inProgress' : thread.status,
    }));
  };

  const handleDraftReset = (threadId: string) => {
    updateThread(threadId, (thread) => ({
      ...thread,
      aiDraftGenerated: false,
      draftSavedAt: undefined,
      draftText: '',
      officialTemplateApplied: false,
      status: thread.replies.some((reply) => reply.authorRole === 'teacher')
        ? thread.status
        : 'before',
    }));
  };

  const handleDraftSave = (threadId: string) => {
    updateThread(threadId, (thread) => {
      if (isReplyLocked(thread) || !thread.draftText.trim()) {
        return thread;
      }

      const savedAt = formatNow();

      return {
        ...thread,
        status: thread.status === 'complete' ? 'inProgress' : thread.status,
        draftSavedAt: savedAt,
        analysis: thread.analysis
          ? {
              ...thread.analysis,
              activityLogs: [
                ...thread.analysis.activityLogs,
                {
                  id: `${thread.id}-draft-save-${
                    thread.analysis.activityLogs.length + 1
                  }`,
                  time: savedAt,
                  actor: '조예인 선생님',
                  action: '답변 초안 임시저장',
                  detail: `작성 중인 답변 초안을 임시저장했습니다. 저장 시각: ${savedAt}.`,
                },
              ],
            }
          : thread.analysis,
      };
    });
  };

  const handleGenerateAiDraft = (threadId: string) => {
    updateThread(threadId, (thread) => {
      if (!canGenerateReplyDraft(thread) || isReplyLocked(thread)) {
        return thread;
      }

      const generatedDraft = createAiReplyDraft(thread);

      return {
        ...thread,
        aiDraftGenerated: true,
        draftSavedAt: undefined,
        draftText: generatedDraft,
        officialTemplateApplied: false,
        status: thread.status === 'complete' ? 'inProgress' : thread.status,
        analysis: thread.analysis
          ? {
              ...thread.analysis,
              activityLogs: [
                ...thread.analysis.activityLogs,
                {
                  id: `${thread.id}-ai-draft-${
                    thread.analysis.activityLogs.length + 1
                  }`,
                  time: formatNow(),
                  actor: 'AI 초안',
                  action: '답변 초안 생성',
                  detail:
                    '학부모 메시지와 위험 요소를 참고해 교사용 답변 초안을 생성했습니다. 자동 전송은 진행되지 않았습니다.',
                },
              ],
            }
          : thread.analysis,
      };
    });
  };

  const handleApplyOfficialTemplate = (threadId: string) => {
    updateThread(threadId, (thread) => {
      if (!canUseOfficialReplyTemplate(thread) || isReplyLocked(thread)) {
        return thread;
      }

      const templateDraft = createOfficialTemplateReply(thread);

      return {
        ...thread,
        aiDraftGenerated: false,
        draftSavedAt: undefined,
        draftText: templateDraft,
        officialTemplateApplied: true,
        status: thread.status === 'complete' ? 'inProgress' : thread.status,
        analysis: thread.analysis
          ? {
              ...thread.analysis,
              activityLogs: [
                ...thread.analysis.activityLogs,
                {
                  id: `${thread.id}-official-template-${
                    thread.analysis.activityLogs.length + 1
                  }`,
                  time: formatNow(),
                  actor: '조예인 선생님',
                  action: '공식 응답 템플릿 적용',
                  detail:
                    '위험 단계 정책에 따라 개별 AI 초안 대신 승인된 공식 응답 템플릿을 답변 입력란에 적용했습니다.',
                },
              ],
            }
          : thread.analysis,
      };
    });
  };

  const handleEvidencePackageCreate = (threadId: string) => {
    updateThread(threadId, (thread) => {
      if (
        !thread.analysis?.packageAvailable ||
        !['high', 'emergency'].includes(getThreadRiskLevel(thread))
      ) {
        return thread;
      }

      return {
        ...thread,
        evidencePackageGenerated: true,
        analysis: {
          ...thread.analysis,
          activityLogs: [
            ...thread.analysis.activityLogs,
            {
              id: `${thread.id}-evidence-package-${
                thread.analysis.activityLogs.length + 1
              }`,
              time: formatNow(),
              actor: '조예인 선생님',
              action: '증빙 패키지 생성',
              detail:
                '완충 요약, 원문, 위험 요소, 판단 근거, 처리 기록을 증빙 패키지로 묶어 생성했습니다.',
            },
          ],
        },
      };
    });
  };

  const handleOpenReplyComposer = (threadId: string) => {
    const thread = threads.find((currentThread) => currentThread.id === threadId);

    setSelectedThreadId(threadId);
    setInitialOriginalViewerRequest(null);
    if (thread && isReplyLocked(thread)) {
      setInitialDetailTabRequest({ tab: 'risk', threadId });
      setReplyComposerThreadId(null);
      pushTeacherMessageRoute(threadId, 'detail');
      return;
    }

    setInitialDetailTabRequest(null);
    setReplyComposerThreadId(threadId);
    pushTeacherMessageRoute(threadId, 'reply');
  };

  const handleReviewComplete = (
    threadId: string,
    review: RiskReviewSubmission,
  ) => {
    updateThread(threadId, (thread) => {
      if (!thread.analysis) {
        return thread;
      }

      const modifiedAt = formatNow();
      const beforeLevel =
        thread.analysis.teacherReviewedRiskLevel ??
        thread.analysis.systemRiskLevel;
      const beforeLevelIndex = systemRiskReviewLevels.indexOf(beforeLevel);
      const afterLevelIndex = systemRiskReviewLevels.indexOf(review.level);
      const isDownwardReview = afterLevelIndex < beforeLevelIndex;
      const isUpwardReview = afterLevelIndex > beforeLevelIndex;
      const isEmergencyDowngrade =
        beforeLevel === 'emergency' && isDownwardReview;
      const reviewReason = review.reason.trim();

      if (isDownwardReview && !reviewReason) {
        return thread;
      }

      if (isEmergencyDowngrade) {
        return {
          ...thread,
          analysis: {
            ...thread.analysis,
            activityLogs: [
              ...thread.analysis.activityLogs,
              {
                id: `${thread.id}-emergency-downgrade-${
                  thread.analysis.activityLogs.length + 1
                }`,
                time: modifiedAt,
                actor: '조예인 선생님',
                action: '긴급 위험도 하향 확인 요청',
                detail: `수정 전 위험도: ${systemRiskLabel[beforeLevel]}, 요청 위험도: ${systemRiskLabel[review.level]}, 수정 사유: "${reviewReason}", 수정자: 조예인 선생님, 수정 시각: ${modifiedAt}. 관리자 또는 별도 책임자의 확인 후 반영됩니다.`,
              },
            ],
            teacherReviewReason: reviewReason,
          },
        };
      }

      const action = isDownwardReview
        ? '위험도 하향 수정'
        : isUpwardReview
          ? '위험도 상향 수정'
          : '위험도 검토 완료';
      const reasonDetail = reviewReason
        ? `수정 사유: "${reviewReason}"`
        : '수정 사유: 해당 없음';

      return {
        ...thread,
        analysis: {
          ...thread.analysis,
          activityLogs: [
            ...thread.analysis.activityLogs,
            {
              id: `${thread.id}-review-${thread.analysis.activityLogs.length + 1}`,
              time: modifiedAt,
              actor: '조예인 선생님',
              action,
              detail: `수정 전 위험도: ${systemRiskLabel[beforeLevel]}, 수정 후 위험도: ${systemRiskLabel[review.level]}, ${reasonDetail}, 수정자: 조예인 선생님, 수정 시각: ${modifiedAt}.`,
            },
          ],
          safetyLock: false,
          teacherReviewReason: reviewReason || undefined,
          teacherReviewedRiskLevel: review.level,
        },
        risk: systemRiskTone[review.level],
        riskReviewRequired: false,
        status: 'inProgress',
      };
    });
  };

  const handleReviewRequest = (threadId: string) => {
    updateThread(threadId, (thread) => {
      if (!thread.analysis) {
        return thread;
      }

      return {
        ...thread,
        analysis: {
          ...thread.analysis,
          activityLogs: [
            ...thread.analysis.activityLogs,
            {
              id: `${thread.id}-review-request-${
                thread.analysis.activityLogs.length + 1
              }`,
              time: formatNow(),
              actor: '조예인 선생님',
              action: '위험도 재검토 요청',
              detail: '담당자에게 위험도 재검토를 요청했습니다.',
            },
          ],
        },
      };
    });
  };

  const handleOriginalViewed = (threadId: string, evidence?: string) => {
    updateThread(threadId, (thread) => {
      if (!thread.analysis) {
        return thread;
      }

      return {
        ...thread,
        analysis: {
          ...thread.analysis,
          activityLogs: [
            ...thread.analysis.activityLogs,
            {
              id: `${thread.id}-original-${thread.analysis.activityLogs.length + 1}`,
              time: formatNow(),
              actor: '조예인 선생님',
              action: '원문 확인',
              detail: evidence
                ? `판단 근거 "${evidence}" 위치를 원문에서 확인했습니다.`
                : '학부모 원문 전체를 확인했습니다.',
            },
          ],
        },
      };
    });
  };

  const handleOpenOriginalPageFromComposer = (threadId: string) => {
    handleOriginalViewed(threadId);
    setInitialDetailTabRequest({ tab: 'conversation', threadId });
    setInitialOriginalViewerRequest({
      request: { source: 'replyComposer' },
      threadId,
    });
    setSelectedThreadId(threadId);
    setReplyComposerThreadId(null);
    pushTeacherMessageRoute(threadId, 'detail');
  };

  const handleReturnToReplyComposer = (threadId: string) => {
    setInitialDetailTabRequest(null);
    setInitialOriginalViewerRequest(null);
    setSelectedThreadId(threadId);
    setReplyComposerThreadId(threadId);
    pushTeacherMessageRoute(threadId, 'reply');
  };

  const handleSubmitReply = (threadId: string) => {
    const thread = threads.find((currentThread) => currentThread.id === threadId);

    if (thread && isReplyLocked(thread)) {
      setSelectedThreadId(threadId);
      setInitialDetailTabRequest({ tab: 'risk', threadId });
      setReplyComposerThreadId(null);
      pushTeacherMessageRoute(threadId, 'detail');
      return;
    }

    updateThread(threadId, (thread) => {
      const nextReply = thread.draftText.trim();

      if (!nextReply) {
        return thread;
      }

      return {
        ...thread,
        aiDraftGenerated: false,
        draftSavedAt: undefined,
        draftText: '',
        officialTemplateApplied: false,
        latestAt: new Date().toISOString(),
        latestAtLabel: formatNow(),
        latestMessage: nextReply,
        replies: [
          ...thread.replies,
          {
            id: `${thread.id}-${thread.replies.length + 1}`,
            authorName: '조예인 선생님',
            authorRole: 'teacher',
            content: nextReply,
            label: '선생님 답변',
            readByParent: false,
            time: formatNow(),
          },
        ],
        status: 'complete',
      };
    });
    setInitialDetailTabRequest(null);
    setInitialOriginalViewerRequest(null);
    setReplyComposerThreadId(null);
    setSelectedThreadId(threadId);
    setSendCompleteThreadId(threadId);
    pushTeacherMessageRoute(threadId, 'detail');
  };

  const tabItems = [
    {
      value: 'all',
      label: <TabLabel count={filteredThreads.length} label="전체 메시지" />,
      content: (
        <BoardWorkspace
          activeFilter={activeFilter}
          emptyDescription="검색어 또는 필터 조건을 바꾸면 다른 메시지를 볼 수 있습니다."
          emptyTitle="조건에 맞는 메시지가 없습니다"
          onFilterChange={setActiveFilter}
          onQueryChange={setQuery}
          onSelect={handleSelectThread}
          onToggleStar={handleToggleStar}
          query={query}
          selectedThreadId={selectedThreadId ?? undefined}
          threads={filteredThreads}
        />
      ),
    },
    {
      value: 'starred',
      label: <TabLabel count={starredThreads.length} label="별표 메시지" />,
      content: (
        <BoardWorkspace
          activeFilter={activeFilter}
          emptyDescription="중요하게 표시한 메시지가 이곳에 모입니다."
          emptyTitle="별표 메시지가 없습니다"
          onFilterChange={setActiveFilter}
          onQueryChange={setQuery}
          onSelect={handleSelectThread}
          onToggleStar={handleToggleStar}
          query={query}
          selectedThreadId={selectedThreadId ?? undefined}
          threads={starredThreads}
        />
      ),
    },
    {
      value: 'drafts',
      label: <TabLabel count={draftThreads.length} label="임시저장 답변" />,
      content: (
        <BoardWorkspace
          activeFilter={activeFilter}
          emptyDescription="작성 중인 답변 초안이 생기면 이곳에 모입니다."
          emptyTitle="임시저장 답변이 없습니다"
          onFilterChange={setActiveFilter}
          onQueryChange={setQuery}
          onSelect={handleSelectThread}
          onToggleStar={handleToggleStar}
          query={query}
          selectedThreadId={selectedThreadId ?? undefined}
          threads={draftThreads}
        />
      ),
    },
  ];
  const pageClassName = `board-inbox-page${
    isSidebarCollapsed ? ' is-sidebar-collapsed' : ''
  }`;

  if (replyComposerThread) {
    return (
      <section className={pageClassName} aria-labelledby="board-composer-title">
        <Sidebar
          activeItem="messages"
          defaultCollapsed={isSidebarCollapsed}
          messageCount={2}
          onCollapsedChange={setIsSidebarCollapsed}
        />
        <main className="board-detail-page">
          <ReplyComposerPage
            onApplyOfficialTemplate={handleApplyOfficialTemplate}
            onBack={() => {
              setInitialOriginalViewerRequest(null);
              setReplyComposerThreadId(null);
              setSelectedThreadId(replyComposerThread.id);
              pushTeacherMessageRoute(replyComposerThread.id, 'detail');
            }}
            onDraftChange={handleDraftChange}
            onDraftReset={handleDraftReset}
            onDraftSave={handleDraftSave}
            onGenerateAiDraft={handleGenerateAiDraft}
            onListOpen={() => {
              setInitialDetailTabRequest(null);
              setInitialOriginalViewerRequest(null);
              setReplyComposerThreadId(null);
              setSelectedThreadId(null);
              pushTeacherMessageRoute();
            }}
            onOpenOriginalPage={handleOpenOriginalPageFromComposer}
            onSubmitReply={handleSubmitReply}
            thread={replyComposerThread}
          />
        </main>
      </section>
    );
  }

  if (selectedThread) {
    return (
      <section className={pageClassName} aria-labelledby="board-detail-title">
        <Sidebar
          activeItem="messages"
          defaultCollapsed={isSidebarCollapsed}
          messageCount={2}
          onCollapsedChange={setIsSidebarCollapsed}
        />
        <main className="board-detail-page">
          <ThreadDetail
            initialOriginalViewer={
              initialOriginalViewerRequest?.threadId === selectedThread.id
                ? initialOriginalViewerRequest.request
                : undefined
            }
            initialTab={
              initialDetailTabRequest?.threadId === selectedThread.id
                ? initialDetailTabRequest.tab
                : undefined
            }
            onBack={() => {
              setInitialDetailTabRequest(null);
              setInitialOriginalViewerRequest(null);
              setSelectedThreadId(null);
              pushTeacherMessageRoute();
            }}
            onEvidencePackageCreate={handleEvidencePackageCreate}
            onOpenReplyComposer={handleOpenReplyComposer}
            onOriginalViewed={handleOriginalViewed}
            onReturnToReplyComposer={handleReturnToReplyComposer}
            onReviewComplete={handleReviewComplete}
            onReviewRequest={handleReviewRequest}
            thread={selectedThread}
          />
          <ReplySendCompleteDialog
            onClose={() => setSendCompleteThreadId(null)}
            open={sendCompleteThreadId === selectedThread.id}
            thread={sendCompleteThread}
          />
        </main>
      </section>
    );
  }

  return (
    <section className={pageClassName} aria-labelledby="board-page-title">
      <Sidebar
        activeItem="messages"
        defaultCollapsed={isSidebarCollapsed}
        messageCount={2}
        onCollapsedChange={setIsSidebarCollapsed}
      />
      <main className="board-list-page">
        <h1 className="board-page-title" id="board-page-title">
          받은 메시지
        </h1>

        <section className="board-list-panel" aria-label="메시지 목록">
          <Tabs
            ariaLabel="메시지 분류"
            className="board-tabs"
            items={tabItems}
            onValueChange={(nextValue) => setActiveTab(nextValue as ThreadTab)}
            value={activeTab}
          />
        </section>
      </main>
      <DraftResumeDialog
        onClose={() => setDraftPromptThreadId(null)}
        onContinue={handleContinueDraft}
        open={draftPromptThread !== null}
      />
    </section>
  );
}
