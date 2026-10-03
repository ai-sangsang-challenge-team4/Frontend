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
  Button,
  Dropdown,
  EmptyState,
  Modal,
  StatusChip,
  Tabs,
  TextField,
} from '../../shared/components/ui';
import {
  emergencyOfficialProcedurePostId,
  replyReferenceGuidePostId,
} from '../safety/guidePostIds';
import { BufferedSummaryCard } from './components/BufferedSummaryCard';
import {
  BreadcrumbSeparator,
  CheckCircleIcon,
  EvidencePackageIcon,
  ExternalLinkIcon,
  FileSearchIcon,
  OriginalViewerIcon,
  RiskGuideIcon,
  RiskSectionIcon,
  SendIcon,
} from './components/MessageIcons';
import { MessageContextCard } from './components/MessageContextCard';
import { OriginalMessageViewer } from './components/OriginalMessageViewer';
import { ProfileAvatar } from './components/ProfileAvatar';
import { ReplyCheckPanel } from './components/ReplyCheckPanel';
import { ReplyEditor } from './components/ReplyEditor';
import { RiskFactorDetail, RiskFactorTitle } from './components/RiskFactorDisplay';
import {
  canGenerateReplyDraft,
  canUseOfficialReplyTemplate,
  filterOptions,
  getBufferedSummaryText,
  getPrimaryParentMessage,
  getThreadRiskLevel,
  getVisibleRiskFactors,
  isReplyLocked,
  riskStageGuides,
  statusChipStatus,
  statusLabel,
  systemRiskLabel,
  systemRiskReviewLevels,
  systemRiskTone,
  threadRiskToSystemRisk,
} from './messageRules';
import type {
  BoardThread,
  DetailTab,
  FilterValue,
  MessagesRouteView,
  OriginalMessageRequest,
  RiskReviewSubmission,
  SystemRiskLevel,
  ThreadTab,
} from './types';
import './TeacherMessages.css';

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

const detailTabLabel: Record<DetailTab, string> = {
  conversation: '대화',
  risk: '위험 요소',
  activity: '처리 기록',
};

const detailTabs: DetailTab[] = ['conversation', 'risk', 'activity'];

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

      <MessageContextCard thread={thread} />

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
          <BufferedSummaryCard
            canInspectOriginal={canInspectOriginal}
            onOpenOriginal={() => openOriginalViewer()}
            onOpenRiskEvidence={() => setActiveDetailTab('risk')}
            summaryText={bufferedSummaryText}
            thread={thread}
          />
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
              <div className="board-answer-actions">
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

      <MessageContextCard thread={thread} />

      <div className="board-reply-composer">
        <ReplyCheckPanel
          isOpen={isCheckPanelOpen}
          onOpenReference={() => {
            openGuidePostFromMessages(
              thread.id,
              'reply',
              replyReferenceGuidePostId,
            );
          }}
          onToggle={() => setIsCheckPanelOpen((isOpen) => !isOpen)}
        />

        <section className="board-reply-context-panel">
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

        <ReplyEditor
          aiNoticeId={aiNoticeId}
          assistButtonDisabled={assistButtonDisabled}
          assistButtonLabel={assistButtonLabel}
          draftStatusText={draftStatusText}
          draftText={thread.draftText}
          hasDraft={hasDraft}
          isLocked={isLocked}
          isOfficialTemplateAvailable={isOfficialTemplateAvailable}
          lockNoticeId={lockNoticeId}
          onAssist={handleAssistAction}
          onDraftChange={(value) => onDraftChange(thread.id, value)}
          onDraftReset={() => onDraftReset(thread.id)}
          onDraftSave={() => onDraftSave(thread.id)}
          onSubmit={() => setIsConfirmOpen(true)}
          stageNotice={stageNotice}
        />
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
