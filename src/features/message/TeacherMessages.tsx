import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from '../../shared/components/teacher-shell/TeacherSidebar';
import { ChevronDownIcon, SearchIcon, StarIcon } from '../../shared/components/teacher-shell/icons';
import {
  Accordion,
  Button,
  Dropdown,
  EmptyState,
  Modal,
  Badge,
  Toast,
  StatusChip,
  Tabs,
  TextField,
} from '../../shared/components/ui';
import {
  emergencyOfficialProcedurePostId,
} from '../safety/guidePostIds';
import { getApiErrorMessage, type ApiError } from '../../shared/api';
import { AsyncContent } from '../../shared/components/feedback';
import { useAuth } from '../auth';
import { canSendEscalationRequest, getEscalationState, submitRiskReview } from '../escalation/api';
import { canRequestEmergencyReview, toDisplayRiskScore } from '../escalation/escalationRules';
import type { EscalationStateResponse } from '../escalation/escalationTypes';
import { useEscalationRequest } from '../escalation/useEscalationRequest';
import { AiJudgmentNotice } from '../safety/AiJudgmentNotice';
import { AdminShareSection } from './components/AdminShareSection';
import { BoardConfirmDialog } from './components/BoardConfirmDialog';
import { ConversationDateChip } from './components/ConversationDateChip';
import { BufferedSummaryCard } from './components/BufferedSummaryCard';
import { AnalysisStateNotice } from './components/AnalysisStateNotice';
import { RiskClassificationPanel } from '../risk-analysis/RiskClassificationPanel';
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
import { RegulationSourceDialog } from './components/RegulationSourceDialog';
import { TemplateReplyEditor } from './components/TemplateReplyEditor';
import { RiskFactorDetail, RiskFactorTitle } from './components/RiskFactorDisplay';
import {
  canGenerateReplyDraft,
  canUseOfficialReplyTemplate,
  aiObjectionTypeLabel,
  compareThreads,
  defaultRiskScore,
  filterOptions,
  getAnalysisStatus,
  getBufferedSummaryText,
  getPrimaryParentMessage,
  getReplyLockNotice,
  getThreadRiskLevel,
  getVisibleRiskFactors,
  hasOriginalMessage,
  isReplyLocked,
  matchesStatusFilter,
  needsTeacherReviewBeforeRequest,
  riskFilterOptions,
  riskScoreGuides,
  riskScores,
  riskScoreToLevel,
  riskStageGuides,
  serverSortOptions,
  sortOptions,
  statusChipStatus,
  statusLabel,
  systemRiskLabel,
  systemRiskTone,
} from './messageRules';
import { formatRegulationSource, searchRegulations, type RegulationSource } from './replyReferences';
import { getReplyDraftTab, hasReplyDraft, selectReplyDraft } from './replyDrafts';
import { formatConversationDate, formatConversationTime } from './messageDates';
import {
  findCautionExpressions,
  changeReplyTemplateDraft,
  createReplyTemplateDraft,
  findReplyTemplate,
  findReplyTemplates,
  getReplyTemplate,
  renderReplyTemplate,
  validateReplyTemplate,
  type ReplyTemplateChange,
} from './replyTemplates';
import type {
  ActivityLog,
  AiObjection,
  AiObjectionType,
  BoardThread,
  DetailTab,
  FilterValue,
  MessagesRouteView,
  OriginalMessageRequest,
  ReplyDraftTab,
  RiskFilterValue,
  RiskReviewSubmission,
  RiskScore,
  SortValue,
  ThreadTab,
} from './types';
import './TeacherMessages.css';
import { compareMessageTimes, formatMessageDate } from '../parent-message/conversation';
import {
  canShareWithAdmin,
  createEscalationSnapshot,
  syncThreadWithEmergencyReview,
  systemRiskLevelFromApi,
} from './escalationSnapshot';
import { messageApiMode, teacherInboxApi } from './api/teacherInboxApi';
import { initialTeacherThreads } from './mockThreads';
import { persistTeacherParentThread, readTeacherParentThreads } from './teacherParentMessages';
import { useActiveMessageCount } from './useActiveMessageCount';
import { getDefaultOriginalReplyId, threadStatus } from './serverThreads';
import { useServerTeacherInbox } from './useServerTeacherInbox';
import { useServerReply, type ServerReplyAction } from './useServerReply';
import { getServerCloseBlockReason, getServerReplyBlockReason } from './serverReplies';
import { TEACHER_RESPONSE_MAX_LENGTH } from './api/teacherInboxTypes';

const isServerInbox = messageApiMode === 'http';

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


const detailTabLabel: Record<DetailTab, string> = {
  conversation: '대화',
  risk: '위험 요소',
  activity: '처리 기록',
};

const detailTabs: DetailTab[] = ['conversation', 'risk', 'activity'];

function formatNow(date = new Date()) {
  return formatMessageDate(date.toISOString());
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

// Threads without analysis (parent-message threads) keep their logs on the thread itself.
function getActivityLogs(thread: BoardThread) {
  return thread.analysis?.activityLogs ?? thread.activityLogs ?? [];
}

function appendActivityLogs(
  thread: BoardThread,
  logs: Omit<ActivityLog, 'id' | 'time'>[],
): BoardThread {
  const time = formatNow();
  const existingLogs = getActivityLogs(thread);
  const activityLogs = [
    ...existingLogs,
    ...logs.map((log, index) => ({
      ...log,
      id: `${thread.id}-log-${existingLogs.length + index + 1}`,
      time,
    })),
  ];

  return thread.analysis
    ? { ...thread, analysis: { ...thread.analysis, activityLogs } }
    : { ...thread, activityLogs };
}

function generateAiReplyDraft(thread: BoardThread, sources: RegulationSource[]) {
  return appendActivityLogs(
    {
      ...thread,
      aiDraftGenerated: true,
      appliedTemplate: undefined,
      draftSavedAt: undefined,
      draftText: createAiReplyDraft(thread),
      officialTemplateApplied: false,
    },
    [{
      actor: 'AI 초안',
      action: '답변 초안 생성',
      detail: `학부모 메시지와 관련 규정을 참고해 교사용 답변 초안을 생성했습니다. 출처: ${sources
        .map(formatRegulationSource).join(' / ')}. 자동 전송은 진행되지 않았습니다.`,
    }],
  );
}

// The server writes its own AI draft; the browser's mock draft needs a matching regulation.
function canUseAiDraftTab(thread: BoardThread) {
  return canGenerateReplyDraft(thread) &&
    (thread.serverComplaintId !== undefined || searchRegulations(thread).status === 'found');
}

const serverReplyStatusText: Record<ServerReplyAction, string> = {
  loadingTemplates: '답장 예시를 불러오는 중…',
  loadingDraft: '임시저장한 답변을 불러오는 중…',
  generatingAiDraft: 'AI 초안을 만드는 중…',
  saving: '임시저장 중…',
  sending: '전송 중…',
};

// A draft built from a template that was deactivated or replaced by a newer version cannot be sent.
function isAppliedTemplateInactive(thread: BoardThread) {
  if (!thread.appliedTemplate) {
    return false;
  }

  const template = getReplyTemplate(thread.appliedTemplate.templateId, thread);

  return (
    !template ||
    template.status !== 'ACTIVE' ||
    template.version !== thread.appliedTemplate.version
  );
}

function getAppliedTemplateLabel(thread: BoardThread) {
  const template = getReplyTemplate(thread.appliedTemplate?.templateId, thread);

  return template && thread.appliedTemplate
    ? `${template.title} 템플릿 v${thread.appliedTemplate.version}`
    : undefined;
}

function getReplyDraftErrors(thread: BoardThread, teacherName: string) {
  // The server's limit (@Size(max = 1500)) applies to every reply.
  if (thread.draftText.trim().length > TEACHER_RESPONSE_MAX_LENGTH) {
    return [`답변은 ${TEACHER_RESPONSE_MAX_LENGTH}자 이하로 입력해 주세요.`];
  }
  if (!thread.appliedTemplate) {
    return canUseOfficialReplyTemplate(thread) && findReplyTemplate(thread)
      ? ['먼저 답장 예시를 골라 주세요.'] : [];
  }
  const template = getReplyTemplate(thread.appliedTemplate.templateId, thread);
  if (!template) return ['사용할 수 없는 예시입니다. 다른 예시를 골라 주세요.'];
  return validateReplyTemplate(template, thread.appliedTemplate, thread, teacherName, thread.draftText);
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
            {thread.needsTeacherReview ? (
              <>
                <span className="board-thread-title-dot" aria-hidden="true" />
                <small className="board-thread-recheck">재확인 필요</small>
              </>
            ) : null}
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

type BoardFilters = {
  query: string;
  risk: RiskFilterValue;
  sort: SortValue;
  status: FilterValue;
};

const defaultBoardFilters: BoardFilters = { query: '', risk: 'all', sort: 'latest', status: 'active' };

// Server inbox only: the page request state below the list.
type ServerListStatus = {
  error: ApiError | null;
  hasNext: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
};

type BoardWorkspaceProps = {
  emptyDescription: string;
  emptyTitle: string;
  filters: BoardFilters;
  serverList?: ServerListStatus;
  isDetailFilterOpen: boolean;
  onDetailFilterToggle: () => void;
  onFiltersChange: (filters: Partial<BoardFilters>) => void;
  onSelect: (threadId: string) => void;
  onToggleStar: (threadId: string) => void;
  selectedThreadId?: string;
  threads: BoardThread[];
};

function BoardWorkspace({
  emptyDescription,
  emptyTitle,
  filters,
  isDetailFilterOpen,
  onDetailFilterToggle,
  onFiltersChange,
  onSelect,
  onToggleStar,
  selectedThreadId,
  serverList,
  threads,
}: BoardWorkspaceProps) {
  const detailFilterId = useId();
  const appliedDetailCount =
    Number(filters.risk !== defaultBoardFilters.risk) +
    Number(filters.sort !== defaultBoardFilters.sort);

  return (
    <>
      <div className="board-toolbar">
        <Dropdown
          ariaLabel="상담 상태 필터"
          className="board-filter-select"
          menuLabel="상담 상태"
          onValueChange={(nextValue) => onFiltersChange({ status: nextValue as FilterValue })}
          options={filterOptions}
          value={filters.status}
        />

        <TextField
          aria-label="메시지 검색"
          containerClassName="board-search-field"
          leadingIcon={<SearchIcon />}
          onChange={(event) => onFiltersChange({ query: event.currentTarget.value })}
          // The server rejects a keyword over 100 characters (400 VALIDATION_FAILED).
          maxLength={serverList ? 100 : undefined}
          placeholder="이름 또는 메시지 내용으로 검색"
          type="search"
          value={filters.query}
        />

        <button
          aria-controls={detailFilterId}
          aria-expanded={isDetailFilterOpen}
          className={`board-detail-filter-toggle${isDetailFilterOpen ? ' is-open' : ''}`}
          onClick={onDetailFilterToggle}
          type="button"
        >
          <span>필터상세</span>
          {appliedDetailCount > 0 ? (
            <span className="board-detail-filter-count">
              {appliedDetailCount}
              <span className="sr-only">개 적용됨</span>
            </span>
          ) : null}
          <ChevronDownIcon aria-hidden="true" />
        </button>
      </div>

      {isDetailFilterOpen ? (
        <div aria-label="상세 필터" className="board-detail-filter" id={detailFilterId} role="group">
          <div className="board-detail-filter-field">
            <span>위험도</span>
            <Dropdown
              ariaLabel="위험도 필터"
              className="board-filter-select board-detail-filter-select"
              menuLabel="위험도"
              onValueChange={(nextValue) => onFiltersChange({ risk: nextValue as RiskFilterValue })}
              options={riskFilterOptions}
              value={filters.risk}
            />
          </div>
          <div className="board-detail-filter-field">
            <span>정렬</span>
            <Dropdown
              ariaLabel="정렬 기준"
              className="board-filter-select board-detail-filter-select"
              menuLabel="정렬 기준"
              onValueChange={(nextValue) => onFiltersChange({ sort: nextValue as SortValue })}
              options={serverList ? serverSortOptions : sortOptions}
              value={filters.sort}
            />
          </div>
          <button
            className="board-outline-button board-detail-filter-reset"
            disabled={appliedDetailCount === 0}
            onClick={() => onFiltersChange({ risk: defaultBoardFilters.risk, sort: defaultBoardFilters.sort })}
            type="button"
          >
            초기화
          </button>
        </div>
      ) : null}

      <AsyncContent
        error={serverList?.error && threads.length === 0 ? serverList.error : null}
        isLoading={Boolean(serverList?.isLoading)}
        loadingMessage="메시지 목록을 불러오고 있어요."
        onRetry={serverList?.onRetry}
      >
        <ThreadList
          emptyDescription={emptyDescription}
          emptyTitle={emptyTitle}
          onSelect={onSelect}
          onToggleStar={onToggleStar}
          selectedThreadId={selectedThreadId}
          threads={threads}
        />
        {serverList?.error && threads.length > 0 ? (
          <p className="board-admin-share-error" role="alert">
            {getApiErrorMessage(serverList.error, '메시지를 더 불러오지 못했습니다.')}{' '}
            <button className="board-admin-share-retry" onClick={serverList.onRetry} type="button">다시 시도</button>
          </p>
        ) : null}
        {serverList?.hasNext ? (
          <button
            className="board-outline-button board-thread-load-more"
            disabled={serverList.isLoadingMore}
            onClick={serverList.onLoadMore}
            type="button"
          >
            {serverList.isLoadingMore ? '불러오는 중…' : '메시지 더 보기'}
          </button>
        ) : null}
      </AsyncContent>
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

type AiObjectionDialogProps = {
  onClose: () => void;
  onSubmit: (objection: Pick<AiObjection, 'reason' | 'type'>) => void;
  open: boolean;
};

function AiObjectionDialog({ onClose, onSubmit, open }: AiObjectionDialogProps) {
  const [type, setType] = useState<AiObjectionType | null>(null);
  const [reason, setReason] = useState('');
  const reasonId = useId();
  const trimmedReason = reason.trim();

  useEffect(() => {
    if (!open) {
      setType(null);
      setReason('');
    }
  }, [open]);

  return (
    <BoardConfirmDialog
      actions={[
        { label: '취소', onClick: onClose },
        {
          disabled: !type || trimmedReason.length === 0,
          label: '이의 제기',
          onClick: () => {
            if (type && trimmedReason) onSubmit({ reason: trimmedReason, type });
          },
          tone: 'primary',
        },
      ]}
      descriptionId="board-ai-objection-description"
      onClose={onClose}
      open={open}
      title="AI 판단이 틀렸나요?"
      titleId="board-ai-objection-title"
    >
      <p className="board-confirm-modal-copy" id="board-ai-objection-description">
        남겨 주신 사유는 AI 오판 사례로 모아
        <br />
        판단 기준을 개선하는 데 활용됩니다.
      </p>
      <fieldset className="board-ai-objection-types">
        <legend>어떤 부분이 틀렸나요?</legend>
        {(Object.keys(aiObjectionTypeLabel) as AiObjectionType[]).map((currentType) => (
          <label key={currentType}>
            <input
              checked={type === currentType}
              name="board-ai-objection-type"
              onChange={() => setType(currentType)}
              type="radio"
              value={currentType}
            />
            <span>{aiObjectionTypeLabel[currentType]}</span>
          </label>
        ))}
      </fieldset>
      <label className="board-ai-objection-reason-label" htmlFor={reasonId}>
        사유
      </label>
      <div className="board-risk-review-textarea-shell board-ai-objection-reason">
        <textarea
          id={reasonId}
          maxLength={300}
          onChange={(event) => setReason(event.target.value)}
          placeholder="AI 판단이 틀렸다고 생각하신 이유를 적어 주세요."
          value={reason}
        />
        <span>{reason.length} / 300</span>
      </div>
    </BoardConfirmDialog>
  );
}

type RiskReviewPanelProps = {
  canReview: boolean;
  errorMessage: string | null;
  isSubmitting: boolean;
  // Shown instead of the info text when the review cannot reach the server.
  notice: string | null;
  onReasonChange: (reason: string) => void;
  onScoreChange: (score: RiskScore) => void;
  onSubmit: () => void;
  reason: string;
  referenceScore: RiskScore;
  score: RiskScore;
  threadId: string;
};

function RiskReviewPanel({
  canReview,
  errorMessage,
  isSubmitting,
  notice,
  onReasonChange,
  onScoreChange,
  onSubmit,
  reason,
  referenceScore,
  score,
  threadId,
}: RiskReviewPanelProps) {
  const trimmedReason = reason.trim();
  const reasonInputId = `board-risk-review-reason-${threadId}`;
  const reasonRequirementId = `${reasonInputId}-requirement`;
  const guideId = `board-risk-review-guide-${threadId}`;
  const level = riskScoreToLevel(score);
  const guide = riskScoreGuides[score];
  const isDownwardReview = score < referenceScore;
  const isUpwardReview = score > referenceScore;
  const isEmergencyDowngrade =
    riskScoreToLevel(referenceScore) === 'emergency' && level !== 'emergency';
  const isReasonRequired = isDownwardReview;
  const isSubmitDisabledByReason =
    isReasonRequired && trimmedReason.length === 0;
  const reviewInfoText = notice ?? (isEmergencyDowngrade
    ? '긴급 단계 하향은 관리자 승인 후 반영되며, 안전 잠금이 해제되기 전까지 긴급 단계 정책이 유지됩니다.'
    : isDownwardReview
      ? '하향 수정 사유는 오탐 원인 분석과 임계값 재조정에 활용됩니다.'
      : isUpwardReview
        ? '상향 수정은 즉시 반영되며 수정 전후 기록이 저장됩니다.'
        : '수정 전·후 위험도, 수정자, 수정 시각은 처리 기록에 저장됩니다.');
  const submitLabel = isSubmitting ? '저장 중…' : isEmergencyDowngrade
    ? '확인 요청'
    : isDownwardReview
      ? '하향 반영'
      : isUpwardReview
        ? '상향 반영'
        : '검토 완료';
  const scorePosition = (value: RiskScore) => (value - 1) / (riskScores.length - 1);
  const sliderStyle = {
    '--board-risk-review-selected-ratio': scorePosition(score),
    '--board-risk-review-current-ratio': scorePosition(referenceScore),
  } as CSSProperties;

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

        <div className="board-risk-review-slider" style={sliderStyle}>
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
              aria-describedby={guideId}
              aria-label="위험도 점수"
              aria-valuetext={`${score}점 ${guide.label}`}
              className="board-risk-review-range"
              disabled={!canReview}
              max={7}
              min={1}
              onChange={(event) => onScoreChange(Number(event.target.value) as RiskScore)}
              step={1}
              type="range"
              value={score}
            />
            <span className={`board-risk-review-thumb board-risk-review-thumb--${score}`} />
          </div>
          <div
            aria-label="위험도 점수 선택"
            className="board-risk-review-levels"
            role="group"
          >
            {riskScores.map((currentScore) => (
              <button
                aria-label={`${currentScore}점 ${riskScoreGuides[currentScore].label}`}
                aria-pressed={score === currentScore}
                className={
                  score === currentScore
                    ? 'board-risk-review-level is-active'
                    : 'board-risk-review-level'
                }
                disabled={!canReview}
                key={currentScore}
                onClick={() => onScoreChange(currentScore)}
                style={{ '--board-risk-review-level-ratio': scorePosition(currentScore) } as CSSProperties}
                type="button"
              >
                {currentScore}
              </button>
            ))}
          </div>
          <div aria-hidden="true" className="board-risk-review-scale-ends">
            <span>매우 안전</span>
            <span>매우 위험</span>
          </div>
        </div>

        <div className={`board-risk-score-guide board-risk-score-guide--${score}`} id={guideId}>
          <strong>
            {score}점 · {guide.label}
            <span className="board-risk-score-guide-level">{systemRiskLabel[level]} 단계</span>
          </strong>
          <p>{guide.example}</p>
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
        {errorMessage ? <p className="board-admin-share-error" role="alert">{errorMessage}</p> : null}
        <button
          aria-describedby={
            isSubmitDisabledByReason ? reasonRequirementId : undefined
          }
          className="board-primary-button board-risk-review-submit"
          disabled={!canReview || isSubmitDisabledByReason || isSubmitting || Boolean(notice)}
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
  onAdminShared: (threadId: string, escalation: { reason: string }) => void;
  onAiObjection: (threadId: string, objection: Pick<AiObjection, 'reason' | 'type'>) => void;
  onEvidencePackageCreate: (threadId: string) => void;
  // Rejects with the API error so the panel can show it.
  onReviewComplete: (threadId: string, review: RiskReviewSubmission) => Promise<void>;
  onOriginalOpen: (evidence?: string) => void;
  onReviewRequest: (threadId: string) => void;
  // Receives every server escalation state so the thread can pick up the admin's decision.
  onServerStateLoaded: (threadId: string, state: EscalationStateResponse) => void;
  // Server inbox only: reloads the thread's detail after a failed request.
  onReloadServerDetail?: (threadId: string) => void;
  thread: BoardThread;
};

function RiskAnalysisPanel({
  onAdminShared,
  onAiObjection,
  onEvidencePackageCreate,
  onReviewComplete,
  onOriginalOpen,
  onReviewRequest,
  onServerStateLoaded,
  onReloadServerDetail,
  thread,
}: RiskAnalysisPanelProps) {
  const [isProcedureOpen, setIsProcedureOpen] = useState(false);
  const [isObjectionOpen, setIsObjectionOpen] = useState(false);
  const analysis = thread.analysis;
  const initialReviewScore =
    analysis?.teacherRiskScore ??
    defaultRiskScore[getThreadRiskLevel(thread)];
  const [reviewScore, setReviewScore] = useState<RiskScore>(initialReviewScore);
  const [reviewReason, setReviewReason] = useState(
    analysis?.teacherReviewReason ?? '',
  );
  const [isReviewSubmitting, setIsReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const isLinked = canSendEscalationRequest(thread.id);
  // Server state for the share and the emergency review (pending approval, safety lock).
  // Depends on the whole thread so a saved risk review refetches the server's current level.
  const loadEscalationState = useCallback(
    (signal: AbortSignal) => isLinked && thread.analysis
      ? getEscalationState(thread.id, { signal, snapshot: createEscalationSnapshot(thread) })
      : Promise.resolve(null),
    [isLinked, thread],
  );
  const escalation = useEscalationRequest(loadEscalationState);
  useEffect(() => {
    if (escalation.data) onServerStateLoaded(thread.id, escalation.data);
  }, [escalation.data, onServerStateLoaded, thread.id]);
  const serverReviewStatus = escalation.data?.riskReviewStatus ?? null;
  const serverSafetyLock = escalation.data?.safetyLock ?? false;
  const isEmergencyReference = riskScoreToLevel(initialReviewScore) === 'emergency';
  // A pending request, or a held lock on a still-EMERGENCY score, makes the server answer 409.
  const reviewNotice = !isLinked
    ? '서버에 등록된 민원이 아니어서 위험도 검토를 저장할 수 없습니다.'
    : serverReviewStatus === 'PENDING_ADMIN_APPROVAL'
      ? '긴급 위험도 하향 요청이 관리자 승인 대기 중입니다. 관리자가 승인하거나 거부한 뒤 다시 검토할 수 있습니다.'
      : isEmergencyReference && !canRequestEmergencyReview(serverReviewStatus, serverSafetyLock)
        ? '안전 잠금이 유지 중이라 긴급 위험도 하향을 다시 요청할 수 없습니다. 관리자가 잠금을 해제한 뒤 요청해 주세요.'
        : null;

  useEffect(() => {
    setReviewScore(initialReviewScore);
    setReviewReason(analysis?.teacherReviewReason ?? '');
    setReviewError(null);
  }, [analysis?.teacherReviewReason, initialReviewScore, thread.id]);

  if (!analysis || getAnalysisStatus(thread) !== 'ready') {
    return (
      <AnalysisStateNotice
        onOriginalOpen={() => onOriginalOpen()}
        onRetry={onReloadServerDetail ? () => onReloadServerDetail(thread.id) : undefined}
        thread={thread}
      />
    );
  }

  const canInspectOriginal = Boolean(
    analysis.canViewOriginal &&
      analysis.originalMessageAvailable &&
      hasOriginalMessage(thread),
  );
  const effectiveRiskLevel = getThreadRiskLevel(thread);
  const currentTone = systemRiskTone[effectiveRiskLevel];
  const currentGuide = riskStageGuides[effectiveRiskLevel];
  const visibleRiskFactors = getVisibleRiskFactors(thread);
  const studentSafetyFactor = visibleRiskFactors.find((factor) =>
    /안전|정서|학생/.test(
      `${factor.id} ${factor.name} ${factor.description}`,
    ),
  );
  const riskFactorItems = analysis.riskFactors.filter((factor) => factor.status !== 'unknown').map((factor) => ({
    id: factor.id,
    title: <RiskFactorTitle factor={factor} />,
    content: <RiskFactorDetail factor={factor} canInspectOriginal={canInspectOriginal} onOriginalOpen={onOriginalOpen} />,
  }));
  const hasGuideAction = Boolean(currentGuide.action && currentGuide.actionLabel);
  const isProcedureGuide = currentGuide.action === 'procedure';
  const isEmergencyGuide = effectiveRiskLevel === 'emergency';
  const canUseGuideAction =
    hasGuideAction && (isProcedureGuide || canInspectOriginal);
  const canShowEvidenceOriginalButton = canInspectOriginal;
  const canShowReviewPanel =
    analysis.canReviewRisk ||
    Boolean(analysis.teacherReviewedRiskLevel) ||
    analysis.safetyLock ||
    thread.riskReviewRequired;
  const canShowStudentSafetyCard = analysis.studentSafetySignal !== 'NONE';
  const hasAiObjection = Boolean(analysis.aiObjections?.length);
  // The server's safety lock keeps the emergency policy even after the level was lowered.
  const replyLocked = isReplyLocked(thread) || serverSafetyLock;
  const reviewRequested = Boolean(analysis.riskReviewRequestedAt);
  const isAwaitingAdminApproval = serverReviewStatus === 'PENDING_ADMIN_APPROVAL';
  const needsOwnReview = needsTeacherReviewBeforeRequest(thread);
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
  const handleReviewSubmit = async () => {
    const reason = reviewReason.trim();

    if (
      isReviewSubmitting ||
      reviewNotice ||
      !analysis.canReviewRisk ||
      (reviewScore < initialReviewScore && !reason)
    ) {
      return;
    }

    setIsReviewSubmitting(true);
    setReviewError(null);
    try {
      await onReviewComplete(thread.id, {
        reason,
        score: reviewScore,
      });
    } catch (error) {
      setReviewError(getApiErrorMessage(error, '위험도 검토를 저장하지 못했습니다. 다시 시도해 주세요.'));
    } finally {
      setIsReviewSubmitting(false);
    }
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
          <div className="board-risk-section-actions">
            <button
              className="board-outline-button board-risk-action-button board-ai-objection-button"
              disabled={hasAiObjection}
              onClick={() => setIsObjectionOpen(true)}
              type="button"
            >
              {hasAiObjection ? '이의 제기 완료' : 'AI 판단이 틀렸어요'}
            </button>
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
        </div>

        <RiskClassificationPanel
          canInspectOriginal={canInspectOriginal}
          onOriginalOpen={onOriginalOpen}
          results={analysis.riskClassifications}
        />

        {riskFactorItems.length > 0 ? (
          <Accordion
            allowMultiple
            className="board-risk-factor-accordion"
            items={riskFactorItems}
          />
        ) : (
          <EmptyState
            className="board-risk-empty board-risk-factor-empty"
            description="분류 결과의 미탐지와 미확인 상태를 구분해 확인해 주세요."
            title="추가로 표시할 판단 근거가 없습니다"
          />
        )}
      </section>

      <AiObjectionDialog
        onClose={() => setIsObjectionOpen(false)}
        onSubmit={(objection) => {
          onAiObjection(thread.id, objection);
          setIsObjectionOpen(false);
        }}
        open={isObjectionOpen}
      />

      {canShowReviewPanel ? (
        <RiskReviewPanel
          canReview={analysis.canReviewRisk}
          errorMessage={reviewError}
          isSubmitting={isReviewSubmitting}
          notice={reviewNotice}
          onReasonChange={setReviewReason}
          onScoreChange={setReviewScore}
          onSubmit={handleReviewSubmit}
          reason={reviewReason}
          referenceScore={initialReviewScore}
          score={reviewScore}
          threadId={thread.id}
        />
      ) : null}

      {replyLocked || thread.riskReviewRequired ? (
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
                <strong>{replyLocked ? '현재 답변 작성이 제한되어 있습니다.' : '위험도 재검토가 필요합니다.'}</strong>
              </div>
              <p>{replyLocked ? getReplyLockNotice(thread).lockDescription : '원문과 판단 근거를 확인한 후 담당자에게 재검토를 요청할 수 있습니다.'}</p>
              {isAwaitingAdminApproval ? (
                <p role="status">관리자 승인 대기 중입니다. 승인되어도 안전 잠금이 해제되기 전까지 답변 작성이 제한됩니다.</p>
              ) : reviewRequested ? (
                <p role="status">재검토 요청이 접수되었습니다. 담당자의 확인을 기다려 주세요.</p>
              ) : null}
              {!reviewRequested && !isAwaitingAdminApproval && needsOwnReview ? <p>위험도 검토를 먼저 완료해야 재검토를 요청할 수 있습니다.</p> : null}
            </div>
          </div>
          <div className="board-risk-lock-actions">
            <button
              className="board-outline-button board-risk-recheck-button"
              disabled={reviewRequested || needsOwnReview || isAwaitingAdminApproval}
              onClick={() => onReviewRequest(thread.id)}
              type="button"
            >
              {isAwaitingAdminApproval ? '관리자 승인 대기' : reviewRequested ? '재검토 요청 완료' : '재검토 요청'}
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
              className="board-outline-button board-risk-action-button board-evidence-package-button"
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

      {canShareWithAdmin(thread) ? (
        <AdminShareSection escalation={escalation} onShared={onAdminShared} thread={thread} />
      ) : null}

      {canShowStudentSafetyCard ? (
        <section className="board-student-safety-card">
          <div className="board-student-safety-content">
            <div className="board-student-safety-copy">
              <div className="board-student-safety-heading">
                <h2>학생 안전 관련 확인</h2>
                {analysis.studentSafetySignal === 'URGENT_REVIEW' ? (
                  <Badge variant="danger">긴급 확인 필요</Badge>
                ) : (
                  <>
                    <span className="board-thread-title-dot" aria-hidden="true" />
                    <small className="board-thread-recheck">추가 확인 필요</small>
                  </>
                )}
              </div>
              <div className="board-student-safety-row">
                <p>
                  <span>
                    {analysis.studentSafetySignal === 'URGENT_REVIEW'
                      ? '학생 안전과 관련된 긴급 확인 신호입니다. 학생의 현재 안전을 우선 확인하고 학교의 공식 대응 절차에 따라 담당자와 즉시 확인해 주세요.'
                      : '학생 안전과 관련해 추가 확인이 필요할 수 있습니다.'}
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
  onReload?: () => void;
  thread: BoardThread;
};

function ActivityLogPanel({ onReload, thread }: ActivityLogPanelProps) {
  const logs = getActivityLogs(thread);
  // A failed GET /history keeps the last loaded logs rather than claiming there are none.
  const unavailableNotice = thread.analysis?.activityLogsUnavailable ? (
    <p className="board-admin-share-error" role="alert">
      처리 기록을 불러오지 못했습니다.{logs.length > 0 ? ' 마지막으로 불러온 기록을 표시합니다.' : ''}{' '}
      {onReload ? <button className="board-admin-share-retry" onClick={onReload} type="button">다시 시도</button> : null}
    </p>
  ) : null;

  if (logs.length === 0 && unavailableNotice) {
    return <section className="board-activity-panel" aria-label="처리 기록">{unavailableNotice}</section>;
  }

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
      {unavailableNotice}
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

// The parent's 확인했어요 counts only when it is newer than the latest teacher reply.
function isAcknowledgedByParent(thread: BoardThread) {
  const latestTeacherReply = thread.replies.filter((reply) => reply.authorRole === 'teacher').at(-1);
  return Boolean(thread.parentAcknowledgedAt && latestTeacherReply?.sentAt &&
    compareMessageTimes(thread.parentAcknowledgedAt, latestTeacherReply.sentAt) >= 0);
}

type DetailProps = {
  onConsultationComplete: (threadId: string) => void;
  // Server inbox only: reloads the thread's detail after a failed request.
  onReloadServerDetail?: (threadId: string) => void;
  initialOriginalViewer?: OriginalMessageRequest;
  initialTab?: DetailTab;
  onBack: () => void;
  onEvidencePackageCreate: (threadId: string) => void;
  onOpenReplyComposer: (threadId: string) => void;
  // Resolves once the original can be shown; a server thread fetches it first
  // (POST /messages/{messageId}/original-views).
  onOriginalViewed: (threadId: string, request: OriginalMessageRequest) => Promise<boolean>;
  onReturnToReplyComposer: (threadId: string) => void;
  // Rejects with the API error so the panel can show it.
  onReviewComplete: (threadId: string, review: RiskReviewSubmission) => Promise<void>;
  onReviewRequest: (threadId: string) => void;
  onAdminShared: RiskAnalysisPanelProps['onAdminShared'];
  onAiObjection: RiskAnalysisPanelProps['onAiObjection'];
  onServerStateLoaded: RiskAnalysisPanelProps['onServerStateLoaded'];
  thread: BoardThread;
};

function ThreadDetail({
  onAdminShared,
  onAiObjection,
  onConsultationComplete,
  initialOriginalViewer,
  initialTab,
  onBack,
  onEvidencePackageCreate,
  onOpenReplyComposer,
  onOriginalViewed,
  onReturnToReplyComposer,
  onReviewComplete,
  onReviewRequest,
  onServerStateLoaded,
  onReloadServerDetail,
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
  const hasDraft = hasReplyDraft(thread);
  // Server threads: after the reply the turn is the parent's, so there is nothing to write yet.
  const serverReplyBlockReason = getServerReplyBlockReason(thread);
  const lockedGuide = getReplyLockNotice(thread);
  const bufferedSummaryText = getBufferedSummaryText(thread);
  const needsBufferedSummary = effectiveRiskLevel !== 'low' ||
    Boolean(thread.analysis && getAnalysisStatus(thread) !== 'ready');
  // A server thread carries a summary per parent message, so every message stays in the conversation and
  // each summarized one shows as its own summary card.
  const usesMessageSummaries = Boolean(thread.serverComplaintId);
  const visibleConversationReplies = needsBufferedSummary && !usesMessageSummaries
    ? thread.replies.filter((reply) => reply.authorRole !== 'parent')
    : thread.replies;
  const initialConversationDate = thread.messageDateLabel ?? formatConversationDate(
    thread.replies[0]?.sentAt ?? thread.latestAt,
  );
  const showBufferedSummaryOnly =
    needsBufferedSummary && !usesMessageSummaries && visibleConversationReplies.length === 0;
  const canInspectOriginal = Boolean(
    thread.analysis?.canViewOriginal &&
      thread.analysis.originalMessageAvailable &&
      hasOriginalMessage(thread),
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

  // The thread on screen, so a slow original request for a thread left behind does not open its viewer here.
  const activeThreadIdRef = useRef(thread.id);

  useEffect(() => {
    activeThreadIdRef.current = thread.id;
    setActiveDetailTab(initialTab ?? 'conversation');
    setOriginalRequest(null);
    setOriginalViewer(initialOriginalViewer ?? null);
  }, [initialOriginalViewer, initialTab, thread.id]);

  const openOriginalViewer = (evidence?: string, replyId?: string) => {
    if (!canInspectOriginal) {
      return;
    }

    setOriginalRequest({ evidence, replyId, source: 'detail' });
  };

  const confirmOriginalViewer = async () => {
    if (!originalRequest) {
      return;
    }

    const request = originalRequest;
    const requestedThreadId = thread.id;
    setOriginalRequest(null);
    if (!(await onOriginalViewed(requestedThreadId, request))) return;
    if (activeThreadIdRef.current === requestedThreadId) setOriginalViewer(request);
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
      {isAcknowledgedByParent(thread) ? (
        <div className="board-consultation-controls">
          <Badge>학부모 확인</Badge>
        </div>
      ) : null}

      {originalViewer ? (
        <OriginalMessageViewer
          selectedEvidence={originalViewer.evidence}
          thread={thread}
        />
      ) : null}

      {!originalViewer && activeDetailTab === 'conversation' ? (
        <>
          {thread.analysis ? (
            <AnalysisStateNotice
              onOriginalOpen={() => openOriginalViewer()}
              onRetry={onReloadServerDetail ? () => onReloadServerDetail(thread.id) : undefined}
              thread={thread}
            />
          ) : null}
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
        <ConversationDateChip label={initialConversationDate} />

        {needsBufferedSummary && !usesMessageSummaries ? (
          <BufferedSummaryCard
            canInspectOriginal={canInspectOriginal}
            onOpenOriginal={() => openOriginalViewer()}
            onOpenRiskEvidence={() => setActiveDetailTab('risk')}
            summaryText={bufferedSummaryText ?? '완충 요약이 준비되지 않았습니다. 필요한 경우 원문 보기에서 내용을 직접 확인해 주세요.'}
            unavailable={!bufferedSummaryText}
            thread={thread}
          />
        ) : null}

        {visibleConversationReplies.map((reply, index) => {
          const dateLabel = reply.sentAt ? formatConversationDate(reply.sentAt) : initialConversationDate;
          const previousReply = visibleConversationReplies[index - 1];
          const previousDateLabel = previousReply?.sentAt
            ? formatConversationDate(previousReply.sentAt)
            : initialConversationDate;
          const time = reply.sentAt ? formatConversationTime(reply.sentAt) : reply.time;

          return (
            <Fragment key={reply.id}>
              {dateLabel !== previousDateLabel ? <ConversationDateChip label={dateLabel} /> : null}
              {reply.summarized ? (
                <BufferedSummaryCard
                  canInspectOriginal={canInspectOriginal}
                  onOpenOriginal={() => openOriginalViewer(undefined, reply.id)}
                  onOpenRiskEvidence={() => setActiveDetailTab('risk')}
                  sentAt={reply.sentAt}
                  summaryText={reply.content}
                  thread={thread}
                />
              ) : (
                <article className={`board-reply board-reply-${reply.authorRole}`}>
                  <div className="board-reply-author">
                    <ProfileAvatar className="board-mini-avatar" />
                    <strong>{reply.authorName}</strong>
                  </div>
                  <div className="board-reply-row">
                    {reply.authorRole === 'teacher' ? (
                      <div className="board-reply-time">
                        {reply.readByParent ? <span>1</span> : null}
                        <time dateTime={reply.sentAt}>{time}</time>
                      </div>
                    ) : null}
                    <div className="board-reply-bubble">
                      <span>{reply.label}</span>
                      <p>{reply.content}</p>
                    </div>
                    {reply.authorRole === 'parent' ? <time dateTime={reply.sentAt}>{time}</time> : null}
                  </div>
                </article>
              )}
            </Fragment>
          );
        })}
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
                {serverReplyBlockReason ? (
                  <>
                    <strong>지금은 답변할 차례가 아닙니다.</strong>
                    <p>{serverReplyBlockReason}</p>
                  </>
                ) : (
                  <>
                    <strong>답변 작성이 필요합니다.</strong>
                    <p>
                      학부모 메시지와 위험 요소를 확인한 뒤 답변 작성 도우미에서
                      초안을 다듬을 수 있습니다.
                    </p>
                  </>
                )}
              </div>
              <div className="board-answer-actions">
                <button
                  className="board-outline-button board-consultation-complete-button"
                  disabled={thread.status === 'complete'}
                  onClick={() => onConsultationComplete(thread.id)}
                  type="button"
                >
                  {thread.status === 'complete' ? '상담 완료됨' : '상담 완료 처리'}
                </button>
                {serverReplyBlockReason ? null : (
                  <button
                    className="board-primary-button board-reply-compose-button"
                    onClick={() => onOpenReplyComposer(thread.id)}
                    type="button"
                  >
                    {hasDraft ? '답변 이어서 작성하기' : '답변 작성하러 가기'}
                  </button>
                )}
              </div>
            </>
          )}
          </div>
          </div>
        </>
      ) : null}

      {!originalViewer && activeDetailTab === 'risk' ? (
        <RiskAnalysisPanel
          onAdminShared={onAdminShared}
          onAiObjection={onAiObjection}
          onEvidencePackageCreate={onEvidencePackageCreate}
          onReviewComplete={onReviewComplete}
          onOriginalOpen={openOriginalViewer}
          onReviewRequest={onReviewRequest}
          onServerStateLoaded={onServerStateLoaded}
          onReloadServerDetail={onReloadServerDetail}
          thread={thread}
        />
      ) : null}

      {!originalViewer && activeDetailTab === 'activity' ? (
        <ActivityLogPanel
          onReload={onReloadServerDetail ? () => onReloadServerDetail(thread.id) : undefined}
          thread={thread}
        />
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
  cautionExpressions: string[];
  draftText: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  thread: BoardThread;
};

function ReplySendConfirmDialog({
  cautionExpressions,
  draftText,
  onCancel,
  onConfirm,
  open,
  thread,
}: ReplySendConfirmDialogProps) {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const templateLabel = getAppliedTemplateLabel(thread);

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
          <span>
            받는 사람: {thread.parentName}
            {templateLabel ? ` · ${templateLabel}` : null}
          </span>
          <strong>{thread.title}</strong>
        </div>
        <div className="board-send-confirm-preview">
          <strong>전송될 답변</strong>
          <p>{draftText}</p>
        </div>
        {cautionExpressions.length > 0 ? (
          <p className="board-reply-lock-notice" role="alert">
            확인할 표현 {cautionExpressions.length}개:{' '}
            {cautionExpressions.map((expression) => `"${expression}"`).join(', ')}
            {' '}— 약속처럼 들릴 수 있어요. 필요하면 다시 고쳐 주세요.
          </p>
        ) : null}
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
          상담을 마치면 상세 화면에서 상담 완료 처리해 주세요.
        </p>
      </div>
    </Modal>
  );
}

type ReplyComposerPageProps = {
  onInitializeDraft: (threadId: string) => void;
  onDraftTabChange: (threadId: string, tab: ReplyDraftTab) => void;
  onApplyOfficialTemplate: (threadId: string, templateId?: string) => void;
  onTemplateChange: (threadId: string, change: ReplyTemplateChange) => void;
  onBack: () => void;
  onDraftChange: (threadId: string, value: string) => void;
  onDraftReset: (threadId: string) => void;
  onDraftSave: (threadId: string) => void;
  onListOpen: () => void;
  onOpenOriginalPage: (threadId: string) => void;
  onSubmitReply: (threadId: string) => void;
  // Server threads only: makes the AI draft again after it failed or was cleared.
  onGenerateAiDraft?: (threadId: string) => void;
  // Server threads only: the reply request in flight for this thread.
  serverReplyAction?: ServerReplyAction | null;
  thread: BoardThread;
};

function ReplyComposerPage({
  onInitializeDraft,
  onDraftTabChange,
  onApplyOfficialTemplate,
  onTemplateChange,
  onBack,
  onDraftChange,
  onDraftReset,
  onDraftSave,
  onListOpen,
  onOpenOriginalPage,
  onSubmitReply,
  onGenerateAiDraft,
  serverReplyAction = null,
  thread,
}: ReplyComposerPageProps) {
  const { user } = useAuth();
  const teacherName = user?.name ?? '담임';
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isCheckPanelOpen, setIsCheckPanelOpen] = useState(true);
  const [isOriginalConfirmOpen, setIsOriginalConfirmOpen] = useState(false);
  const [referenceSource, setReferenceSource] = useState<RegulationSource | null>(null);
  const initializedThreadRef = useRef<string | null>(null);
  const activeDraftTab = getReplyDraftTab(thread);
  const hasDraft = thread.draftText.trim().length > 0;
  const bufferedSummaryText = getBufferedSummaryText(thread);
  const isLocked = isReplyLocked(thread);
  const riskLevel = getThreadRiskLevel(thread);
  const regulationResult = useMemo(() => searchRegulations(thread), [thread]);
  const isServerThread = thread.serverComplaintId !== undefined;
  const isAiDraftAvailable = canUseAiDraftTab(thread);
  const serverBlockReason = getServerReplyBlockReason(thread);
  const isOfficialTemplateAvailable = canUseOfficialReplyTemplate(thread);
  const replyTemplate = isOfficialTemplateAvailable
    ? findReplyTemplate(thread)
    : undefined;
  const isTemplateInactive = isAppliedTemplateInactive(thread);
  const isManualTabDisabled = Boolean(thread.appliedTemplate || replyTemplate);
  const isDraftInputDisabled = activeDraftTab === 'ai' && !replyTemplate && !thread.appliedTemplate &&
    !isAiDraftAvailable;
  const draftErrors = getReplyDraftErrors(thread, teacherName);
  const matchingTemplates = findReplyTemplates(thread);
  const appliedTemplateLabel = getAppliedTemplateLabel(thread);
  const lockNoticeId = `board-reply-lock-notice-${thread.id}`;
  const aiNoticeId = `board-ai-draft-notice-${thread.id}`;
  const canInspectOriginal = Boolean(
    thread.analysis?.canViewOriginal &&
      thread.analysis.originalMessageAvailable &&
      hasOriginalMessage(thread),
  );
  const isBufferedContext = riskLevel !== 'low' ||
    Boolean(thread.analysis && getAnalysisStatus(thread) !== 'ready');
  const contextMessageText = isBufferedContext
    ? (bufferedSummaryText ?? '완충 요약을 확인할 수 없습니다. 필요한 경우 원문 보기를 이용해 주세요.')
    : getPrimaryParentMessage(thread);
  const shouldShowOriginalButton = riskLevel !== 'low' && canInspectOriginal;
  // Server threads: the AI tab offers the draft again once it is empty (failed, reset).
  const canRequestAiDraft = isServerThread && isAiDraftAvailable && !hasDraft && !serverBlockReason &&
    Boolean(onGenerateAiDraft);
  const assistButtonLabel = canRequestAiDraft
    ? 'AI 초안 생성'
    : thread.officialTemplateApplied
      ? '템플릿 다시 적용'
      : '공식 템플릿 적용';
  const assistButtonDisabled = canRequestAiDraft ? false : isLocked || !replyTemplate;
  const stageNotice = isLocked
    ? getReplyLockNotice(thread).lockDescription
    : serverBlockReason
      ? serverBlockReason
    : riskLevel === 'high'
      ? replyTemplate
        ? `위험 단계: 개별 AI 초안 대신 답장 예시(${replyTemplate.title})를 사용합니다.${replyTemplate.approved ? '' : ' 예시 문구는 확정 전입니다.'}`
        : '이 메시지에 맞는 공식 템플릿이 없습니다. 내용을 검토한 뒤 직접 작성해 주세요.'
      : !isServerThread && regulationResult.status === 'not_found'
        ? '관련 규정이 등록된 자료에 없어 AI 초안을 생성하지 않습니다. 직접 작성해 주세요.'
        : riskLevel === 'low'
          ? '일반 단계: 원문과 RAG 기반 참고자료로 답변 초안을 생성할 수 있습니다.'
          : '주의 단계: 완충 요약과 원문을 확인한 뒤 AI 초안을 교사가 검토하고 수정하는 것을 권고합니다.';
  const draftStatusText = isLocked
    ? '안전 잠금 · 전송 불가'
    : serverReplyAction
      ? serverReplyStatusText[serverReplyAction]
    : serverBlockReason
      ? '전송 불가'
    : isTemplateInactive
      ? '적용한 템플릿을 더 이상 사용할 수 없습니다. 템플릿을 다시 적용해 주세요.'
      : draftErrors.length > 0
        ? draftErrors.join(' ')
        : thread.draftSavedAt
          ? `마지막 임시저장 ${thread.draftSavedAt}`
          : thread.officialTemplateApplied
            ? `${appliedTemplateLabel ?? '공식 템플릿'} 적용됨`
            : thread.aiDraftGenerated
              ? 'AI 초안 적용됨'
              : hasDraft
                ? '작성 중'
                : '작성 중인 답변 없음';
  const handleAssistAction = () => {
    if (canRequestAiDraft) {
      onGenerateAiDraft?.(thread.id);
      return;
    }
    if (replyTemplate) {
      const selected = matchingTemplates.find((template) => template.templateId === thread.appliedTemplate?.templateId);
      onApplyOfficialTemplate(thread.id, selected?.templateId ?? replyTemplate.templateId);
    }
  };
  const requestOriginalOpen = () => {
    if (!canInspectOriginal) {
      return;
    }

    setIsOriginalConfirmOpen(true);
  };

  // Waits for the lock to clear, so a server thread whose analysis is still loading initializes once it is ready.
  useEffect(() => {
    if (!isLocked && initializedThreadRef.current !== thread.id) {
      initializedThreadRef.current = thread.id;
      onInitializeDraft(thread.id);
    }
  }, [isLocked, onInitializeDraft, thread.id]);

  useEffect(() => {
    setIsConfirmOpen(false);
    setIsCheckPanelOpen(true);
    setIsOriginalConfirmOpen(false);
    setReferenceSource(null);
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

      <AiJudgmentNotice />

      <div className="board-reply-composer">
        <ReplyCheckPanel
          isAiDraftFromServer={isServerThread}
          isOpen={isCheckPanelOpen}
          onOpenReference={setReferenceSource}
          onToggle={() => setIsCheckPanelOpen((isOpen) => !isOpen)}
          regulationResult={regulationResult}
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
          activeDraftTab={activeDraftTab}
          aiNoticeId={aiNoticeId}
          assistButtonDisabled={assistButtonDisabled}
          assistButtonLabel={assistButtonLabel}
          draftStatusText={draftStatusText}
          draftText={thread.draftText}
          hasDraft={hasDraft}
          isLocked={isLocked}
          isBusy={serverReplyAction !== null}
          isDraftInputDisabled={isDraftInputDisabled || Boolean(serverBlockReason)}
          isManualTabDisabled={isManualTabDisabled}
          lockNoticeId={lockNoticeId}
          maxLength={TEACHER_RESPONSE_MAX_LENGTH}
          onAssist={handleAssistAction}
          onDraftChange={(value) => onDraftChange(thread.id, value)}
          onDraftTabChange={(tab) => onDraftTabChange(thread.id, tab)}
          onDraftReset={() => onDraftReset(thread.id)}
          onDraftSave={() => onDraftSave(thread.id)}
          onSubmit={() => setIsConfirmOpen(true)}
          onOpenProcedure={() => openGuidePostFromMessages(thread.id, 'reply', emergencyOfficialProcedurePostId)}
          saveDisabled={Boolean(serverBlockReason) || draftErrors.length > 0}
          showAssistButton={isOfficialTemplateAvailable || canRequestAiDraft}
          stageNotice={stageNotice}
          submitDisabled={isTemplateInactive || draftErrors.length > 0 || isDraftInputDisabled ||
            Boolean(serverBlockReason)}
          templateEditor={!isLocked && (thread.appliedTemplate || replyTemplate) ? (
            <>
              {isTemplateInactive ? (
                <p className="board-reply-lock-notice" role="alert">이 예시는 더 이상 사용할 수 없습니다. 최신 예시를 다시 적용하면 입력한 빈칸과 직접 고친 문장은 유지됩니다.</p>
              ) : null}
              <TemplateReplyEditor
                disabled={isTemplateInactive || serverReplyAction !== null || Boolean(serverBlockReason)}
                draft={thread.appliedTemplate}
                onApply={(templateId) => onApplyOfficialTemplate(thread.id, templateId)}
                onChange={(change) => onTemplateChange(thread.id, change)}
                teacherName={teacherName}
                templates={matchingTemplates}
                thread={thread}
              />
            </>
          ) : undefined}
        />
      </div>

      <ReplySendConfirmDialog
        cautionExpressions={findCautionExpressions(thread.draftText)}
        draftText={thread.draftText.trim()}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={() => {
          setIsConfirmOpen(false);
          onSubmitReply(thread.id);
        }}
        open={isConfirmOpen}
        thread={thread}
      />
      <RegulationSourceDialog onClose={() => setReferenceSource(null)} source={referenceSource} />
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
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };
  const initialMessagesRouteState = getMessagesRouteStateFromLocation({
    initialThreadId,
    initialView,
  });
  const [filters, setFilters] = useState<BoardFilters>(defaultBoardFilters);
  const [isDetailFilterOpen, setIsDetailFilterOpen] = useState(false);
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
  const [threads, setThreads] = useState<BoardThread[]>(() => isServerInbox
    ? []
    : [...readTeacherParentThreads(user?.userId ?? 0), ...initialTeacherThreads]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const serverInbox = useServerTeacherInbox({ enabled: isServerInbox, filters, setThreads });
  const { loadDetail: loadServerDetail, viewOriginal: viewServerOriginal } = serverInbox;
  const serverReply = useServerReply({
    setThreads,
    reloadDetail: loadServerDetail,
    onMessage: setToastMessage,
  });
  // The sidebar badge follows the inbox's default "진행 중 상담" filter (the server's OPEN count over HTTP).
  const serverActiveMessageCount = useActiveMessageCount(user?.userId ?? 0);
  const activeMessageCount = isServerInbox
    ? serverActiveMessageCount
    : threads.filter((thread) => thread.status !== 'complete').length;
  const dismissToast = useCallback(() => setToastMessage(null), []);
  // Submission keys already handled, so a double click or retry stores the reply only once.
  const sentReplyKeysRef = useRef(new Set<string>());
  // The composer on screen, read when a server send finishes after the teacher may have moved on.
  const replyComposerThreadIdRef = useRef(replyComposerThreadId);
  useEffect(() => {
    replyComposerThreadIdRef.current = replyComposerThreadId;
  }, [replyComposerThreadId]);

  useEffect(() => {
    if (isServerInbox) return;
    const refresh = () => setThreads((current) => [
      ...readTeacherParentThreads(user?.userId ?? 0), ...current.filter((thread) => thread.parentUserId === undefined),
    ]);
    window.addEventListener('storage', refresh);
    window.addEventListener('parent-messages-changed', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('parent-messages-changed', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [user?.userId]);

  const syncRouteState = useCallback(
    (routeState: {
      threadId: string | null;
      view: MessagesRouteView | null;
    }) => {
      setDraftPromptThreadId(null);
      // pushTeacherMessageRoute also fires popstate, so keep a request aimed at the detail being opened.
      const keepRequest = <T extends { threadId: string }>(current: T | null) =>
        current?.threadId === routeState.threadId && routeState.view !== 'reply' ? current : null;
      setInitialDetailTabRequest(keepRequest);
      setInitialOriginalViewerRequest(keepRequest);
      setReplyComposerThreadId(
        routeState.view === 'reply' ? routeState.threadId : null,
      );
      setSelectedThreadId(routeState.threadId);
      setSendCompleteThreadId((current) => current === routeState.threadId ? current : null);
    },
    [],
  );

  useEffect(() => {
    syncRouteState(
      getMessagesRouteStateFromLocation({ initialThreadId, initialView }),
    );
  }, [initialThreadId, initialView, location.pathname, syncRouteState]);

  useEffect(() => {
    const handlePopState = () => {
      syncRouteState(getMessagesRouteStateFromLocation({}));
    };

    window.addEventListener('popstate', handlePopState);

    return () => window.removeEventListener('popstate', handlePopState);
  }, [syncRouteState]);

  const filteredThreads = useMemo(() => {
    // The server already filtered and sorted the list.
    if (isServerInbox) {
      return serverInbox.listIds
        .map((id) => threads.find((thread) => thread.id === id))
        .filter((thread): thread is BoardThread => Boolean(thread));
    }
    const normalizedQuery = filters.query.trim().toLowerCase();

    return threads.filter((thread) => {
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

      return (
        matchesStatusFilter(thread.status, filters.status) &&
        (filters.risk === 'all' || getThreadRiskLevel(thread) === filters.risk) &&
        matchesQuery
      );
    }).sort((left, right) => compareThreads(left, right, filters.sort));
  }, [filters, serverInbox.listIds, threads]);

  // Opening a server thread loads its detail, conversation, risk, and history.
  useEffect(() => {
    if (!isServerInbox || !selectedThreadId) return;
    const controller = new AbortController();
    loadServerDetail(selectedThreadId, controller.signal).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setToastMessage(getApiErrorMessage(error, '메시지 상세 정보를 불러오지 못했습니다.'));
    });
    return () => controller.abort();
  }, [loadServerDetail, selectedThreadId]);

  // A server thread closes through POST /close; the reloaded detail then shows it as complete.
  const closingServerThreadIds = useRef(new Set<string>());
  const completeServerConsultation = async (thread: BoardThread) => {
    const complaintId = thread.serverComplaintId;
    if (!complaintId || closingServerThreadIds.current.has(thread.id)) return;
    const blockReason = getServerCloseBlockReason(thread);
    if (blockReason) {
      setToastMessage(blockReason);
      return;
    }
    closingServerThreadIds.current.add(thread.id);
    try {
      await teacherInboxApi.closeComplaint(complaintId);
      // Shown as complete even if the following reload fails, so the close button cannot be pressed again.
      updateThread(thread.id, (current) => ({
        ...current,
        serverStatus: { status: 'CLOSED', waitingFor: 'NONE' },
        status: threadStatus('CLOSED', 'NONE', true),
      }));
      void serverInbox.reloadList();
      setToastMessage('상담을 완료 처리했습니다.');
    } catch (error) {
      setToastMessage(getApiErrorMessage(error, '상담을 완료 처리하지 못했습니다. 다시 시도해 주세요.'));
    } finally {
      closingServerThreadIds.current.delete(thread.id);
      refreshServerThread(thread.id);
    }
  };

  const retryServerDetail = (threadId: string) => {
    loadServerDetail(threadId).catch((error: unknown) => {
      setToastMessage(getApiErrorMessage(error, '메시지 상세 정보를 불러오지 못했습니다.'));
    });
  };

  const refreshServerThread = (threadId: string) => {
    if (!isServerInbox) return;
    loadServerDetail(threadId).catch(() => undefined);
  };

  const starredThreads = filteredThreads.filter((thread) => thread.isPinned);
  const draftThreads = filteredThreads.filter(
    hasReplyDraft,
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
    const current = threads.find((thread) => thread.id === threadId);
    if (!current) return false;
    const next = updater(current);
    try {
      persistTeacherParentThread(user?.userId ?? 0, next, current);
      setThreads((currentThreads) => currentThreads.map((thread) => thread.id === threadId ? next : thread));
      return true;
    } catch {
      setToastMessage('문의 처리 내용을 저장하지 못했습니다. 다시 시도해 주세요.');
      return false;
    }
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

    if (thread && hasReplyDraft(thread)) {
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
    updateThread(threadId, (thread) => {
      if (isReplyLocked(thread) || thread.appliedTemplate || (canUseOfficialReplyTemplate(thread) && findReplyTemplate(thread))) return thread;
      if (getReplyDraftTab(thread) === 'ai' && !canUseAiDraftTab(thread)) return thread;
      return {
        ...thread,
        aiDraftGenerated: value.trim() ? thread.aiDraftGenerated : false,
        draftSavedAt: undefined,
        officialTemplateApplied: value.trim()
          ? thread.officialTemplateApplied
          : false,
        appliedTemplate: value.trim() ? thread.appliedTemplate : undefined,
        draftText: value,
      };
    });
  };

  const handleInitializeDraft = (threadId: string) => {
    const target = threads.find((thread) => thread.id === threadId);
    if (target?.serverComplaintId !== undefined) {
      void serverReply.initialize(target);
      return;
    }
    updateThread(threadId, (thread) => {
      if (isReplyLocked(thread)) return thread;
      // An existing AI tab still counts after its contents have been cleared.
      const hasAiDraft = thread.replyDrafts?.ai !== undefined || (
        getReplyDraftTab(thread) === 'ai' && Boolean(thread.draftText || thread.appliedTemplate)
      );
      const next = selectReplyDraft(thread, 'ai');
      const result = searchRegulations(next);
      return !hasAiDraft && canGenerateReplyDraft(next) && result.status === 'found'
        ? generateAiReplyDraft(next, result.sources)
        : next;
    });
  };

  const handleDraftTabChange = (threadId: string, tab: ReplyDraftTab) => {
    updateThread(threadId, (thread) => {
      if (isReplyLocked(thread)) return thread;
      if (tab === 'manual' && (thread.appliedTemplate || (canUseOfficialReplyTemplate(thread) && findReplyTemplate(thread)))) return thread;
      return selectReplyDraft(thread, tab);
    });
  };

  const handleTemplateChange = (threadId: string, change: ReplyTemplateChange) => {
    updateThread(threadId, (thread) => {
      if (isReplyLocked(thread) || !thread.appliedTemplate || isAppliedTemplateInactive(thread)) return thread;
      const template = getReplyTemplate(thread.appliedTemplate.templateId, thread);
      if (!template) return thread;
      const draft = changeReplyTemplateDraft(template, thread.appliedTemplate, change);
      return { ...thread, appliedTemplate: draft, draftSavedAt: undefined, draftText: renderReplyTemplate(template, thread, user?.name ?? '담임', draft) };
    });
  };

  const handleDraftReset = (threadId: string) => {
    updateThread(threadId, (thread) => isReplyLocked(thread) ? thread : ({
      ...thread,
      aiDraftGenerated: false,
      appliedTemplate: undefined,
      draftSavedAt: undefined,
      draftText: '',
      officialTemplateApplied: false,
    }));
  };

  const handleDraftSave = (threadId: string) => {
    const target = threads.find((thread) => thread.id === threadId);
    if (target?.serverComplaintId !== undefined) {
      if (getReplyDraftErrors(target, user?.name ?? '담임').length === 0) void serverReply.saveDraft(target);
      return;
    }
    updateThread(threadId, (thread) => {
      if (isReplyLocked(thread) || !thread.draftText.trim()) {
        return thread;
      }

      const savedAt = formatNow();

      return appendActivityLogs({ ...thread, draftSavedAt: savedAt }, [
        {
          actor: '조예인 선생님',
          action: '답변 초안 임시저장',
          detail: `작성 중인 답변 초안을 임시저장했습니다. 저장 시각: ${savedAt}.`,
        },
      ]);
    });
  };

  const handleApplyOfficialTemplate = (threadId: string, templateId?: string) => {
    const target = threads.find((thread) => thread.id === threadId);
    const template = target && canUseOfficialReplyTemplate(target)
      ? findReplyTemplates(target).find((item) => !templateId || item.templateId === templateId)
      : undefined;

    if (!template || !target) {
      return;
    }

    const draft = createReplyTemplateDraft(template, target, user?.name ?? '담임', target.appliedTemplate);

    updateThread(threadId, (thread) =>
      appendActivityLogs(
        {
          ...selectReplyDraft(thread, 'ai'),
          aiDraftGenerated: false,
          appliedTemplate: draft,
          draftSavedAt: undefined,
          draftText: renderReplyTemplate(template, thread, user?.name ?? '담임', draft),
          officialTemplateApplied: true,
        },
        [
          {
            actor: user?.name ?? '선생님',
            action: '공식 응답 템플릿 적용',
            detail: `위험 단계 정책에 따라 개별 AI 초안 대신 공식 응답 템플릿 "${template.title}" v${template.version}을 답변 입력란에 적용했습니다.`,
          },
        ],
      ),
    );
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

  const handleAdminShared = (threadId: string, escalation: { reason: string }) => {
    updateThread(threadId, (thread) =>
      appendActivityLogs(thread, [
        {
          actor: user?.name ?? '선생님',
          action: '관리자 공유',
          detail: `관리자에게 공동 검토를 요청했습니다. 공유 사유: "${escalation.reason}"`,
        },
      ]),
    );
    refreshServerThread(threadId);
  };

  const logReplyBlocked = (threadId: string) => {
    updateThread(threadId, (thread) =>
      appendActivityLogs(thread, [
        {
          actor: '시스템',
          action: '답변 생성·전송 차단',
          detail: '긴급 잠금 상태라 답변 작성 경로를 차단하고 공식 절차 안내로 이동했습니다.',
        },
      ]),
    );
  };

  const handleOpenReplyComposer = (threadId: string) => {
    const thread = threads.find((currentThread) => currentThread.id === threadId);

    setSelectedThreadId(threadId);
    setInitialOriginalViewerRequest(null);
    if (thread && isReplyLocked(thread)) {
      logReplyBlocked(threadId);
      setInitialDetailTabRequest({ tab: 'risk', threadId });
      setReplyComposerThreadId(null);
      pushTeacherMessageRoute(threadId, 'detail');
      return;
    }

    setInitialDetailTabRequest(null);
    setReplyComposerThreadId(threadId);
    pushTeacherMessageRoute(threadId, 'reply');
  };

  const handleReviewComplete = async (
    threadId: string,
    review: RiskReviewSubmission,
  ) => {
    const target = threads.find((thread) => thread.id === threadId);

    if (!target?.analysis) {
      return;
    }

    const reviewReason = review.reason.trim();
    // The server decides the resulting level and whether admin approval is needed;
    // the saved state below only uses its response.
    const result = await submitRiskReview(
      threadId,
      { reason: reviewReason || null, riskScore: review.score },
      { snapshot: createEscalationSnapshot(target) },
    );
    const modifiedAt = formatNow();
    const beforeLevel = systemRiskLevelFromApi[result.previousLevel];
    const afterLevel = systemRiskLevelFromApi[result.riskLevel];
    const beforeLabel = `${systemRiskLabel[beforeLevel]}(${toDisplayRiskScore(result.previousScore)}점)`;
    const afterLabel = `${systemRiskLabel[afterLevel]}(${toDisplayRiskScore(result.riskScore)}점)`;
    const reviewer = result.reviewedBy;
    const reasonDetail = result.reason
      ? `수정 사유: "${result.reason}"`
      : '수정 사유: 해당 없음';

    updateThread(threadId, (thread) => {
      if (!thread.analysis) {
        return thread;
      }

      if (result.status !== 'APPLIED') {
        const isPending = result.status === 'PENDING_ADMIN_APPROVAL';
        return {
          ...thread,
          analysis: {
            ...thread.analysis,
            activityLogs: [
              ...thread.analysis.activityLogs,
              {
                id: `${thread.id}-emergency-review-${result.emergencyReviewRequestId ?? result.riskReviewId}`,
                time: modifiedAt,
                actor: reviewer,
                action: isPending ? '긴급 위험도 하향 승인 요청' : '위험도 변경 반려',
                detail: `현재 위험도: ${beforeLabel}, 요청 위험도: ${afterLabel}, ${reasonDetail}, 요청자: ${reviewer}, 요청 시각: ${modifiedAt}. ${
                  isPending ? '관리자 승인 후 반영됩니다.' : '위험도는 변경되지 않았습니다.'
                }`,
              },
            ],
            // A pending request holds the safety lock, so the emergency policy stays.
            safetyLock: thread.analysis.safetyLock || result.safetyLock,
            ...(result.emergencyReviewRequestId === undefined ? {} : {
              emergencyReview: {
                requestId: result.emergencyReviewRequestId,
                status: result.status,
                safetyLock: result.safetyLock,
              },
            }),
            teacherReviewReason: result.reason || undefined,
          },
        };
      }

      const action = result.direction === 'LOWERED'
        ? '위험도 하향 수정'
        : result.direction === 'RAISED'
          ? '위험도 상향 수정'
          : '위험도 검토 완료';

      return {
        ...thread,
        analysis: {
          ...thread.analysis,
          activityLogs: [
            ...thread.analysis.activityLogs,
            {
              id: `${thread.id}-risk-review-${result.riskReviewId}`,
              time: modifiedAt,
              actor: reviewer,
              action,
              detail: `수정 전 위험도: ${beforeLabel}, 수정 후 위험도: ${afterLabel}, ${reasonDetail}, 수정자: ${reviewer}, 수정 시각: ${modifiedAt}.`,
            },
          ],
          // Only a designated reviewer can lift the lock; raising to emergency or the server's lock sets it.
          safetyLock:
            thread.analysis.safetyLock || result.safetyLock || afterLevel === 'emergency',
          teacherReviewReason: result.reason || undefined,
          teacherReviewedRiskLevel: afterLevel,
          teacherRiskScore: result.reviewScale as RiskScore,
        },
        risk: systemRiskTone[afterLevel],
        riskReviewRequired: false,
      };
    });
    // The server holds the resulting level, lock, and RISK_REVIEWED history.
    refreshServerThread(threadId);
  };

  const handleServerStateLoaded: RiskAnalysisPanelProps['onServerStateLoaded'] = (threadId, state) => {
    const target = threads.find((thread) => thread.id === threadId);
    if (!target) return;
    const synced = syncThreadWithEmergencyReview(target, state);
    if (synced !== target) updateThread(threadId, () => synced);
  };

  const handleAiObjection: RiskAnalysisPanelProps['onAiObjection'] = (threadId, objection) => {
    updateThread(threadId, (thread) => {
      if (!thread.analysis) {
        return thread;
      }

      const createdAt = new Date().toISOString();
      const objections = thread.analysis.aiObjections ?? [];

      return {
        ...thread,
        analysis: {
          ...thread.analysis,
          aiObjections: [
            ...objections,
            { ...objection, createdAt, id: `${thread.id}-ai-objection-${objections.length + 1}` },
          ],
          activityLogs: [
            ...thread.analysis.activityLogs,
            {
              id: `${thread.id}-ai-objection-log-${thread.analysis.activityLogs.length + 1}`,
              time: formatNow(),
              actor: user?.name ?? '선생님',
              action: 'AI 판단 이의 제기',
              detail: `유형: ${aiObjectionTypeLabel[objection.type]}, 사유: "${objection.reason}". 오판 사례로 평가 데이터에 저장됩니다.`,
            },
          ],
        },
      };
    });
  };

  const handleReviewRequest = (threadId: string) => {
    updateThread(threadId, (thread) => {
      if (!thread.analysis || thread.analysis.riskReviewRequestedAt || needsTeacherReviewBeforeRequest(thread) ||
        (!isReplyLocked(thread) && !thread.riskReviewRequired)) {
        return thread;
      }

      return {
        ...thread,
        analysis: {
          ...thread.analysis,
          riskReviewRequestedAt: new Date().toISOString(),
          activityLogs: [
            ...thread.analysis.activityLogs,
            {
              id: `${thread.id}-review-request-${
                thread.analysis.activityLogs.length + 1
              }`,
              time: formatNow(),
              actor: user?.name ?? '선생님',
              action: '위험도 재검토 요청',
              detail: isReplyLocked(thread)
                ? '담당자에게 위험도 재검토를 요청했습니다. 지정 검토자의 확인 전까지 안전 잠금은 유지됩니다.'
                : '담당자에게 위험도 재검토를 요청했습니다.',
            },
          ],
        },
      };
    });
  };

  const handleOriginalViewed = async (threadId: string, { evidence, replyId }: OriginalMessageRequest = {}) => {
    // The server records the view itself (ORIGINAL_VIEWED) and its history replaces the local log.
    const serverThread = threads.find((thread) => thread.id === threadId && thread.serverComplaintId);
    if (serverThread) {
      const originalReplyId = replyId ?? getDefaultOriginalReplyId(serverThread);
      if (!originalReplyId) {
        setToastMessage('원문을 확인할 학부모 메시지가 없습니다.');
        return false;
      }
      try {
        await viewServerOriginal(threadId, originalReplyId);
        return true;
      } catch (error) {
        setToastMessage(getApiErrorMessage(error, '원문을 불러오지 못했습니다. 다시 시도해 주세요.'));
        return false;
      }
    }
    updateThread(threadId, (thread) =>
      appendActivityLogs(thread, [
        {
          actor: '조예인 선생님',
          action: '원문 확인',
          detail: evidence
            ? `판단 근거 "${evidence}" 위치를 원문에서 확인했습니다.`
            : '학부모 원문 전체를 확인했습니다.',
        },
      ]),
    );
    return true;
  };

  const handleOpenOriginalPageFromComposer = async (threadId: string) => {
    if (!(await handleOriginalViewed(threadId))) return;
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

    if (!thread) {
      return;
    }

    if (isReplyLocked(thread)) {
      logReplyBlocked(threadId);
      setSelectedThreadId(threadId);
      setInitialDetailTabRequest({ tab: 'risk', threadId });
      setReplyComposerThreadId(null);
      pushTeacherMessageRoute(threadId, 'detail');
      return;
    }

    const nextReply = thread.draftText.trim();

    if (
      !nextReply ||
      (getReplyDraftTab(thread) === 'ai' && !thread.appliedTemplate && !canUseAiDraftTab(thread)) ||
      getServerReplyBlockReason(thread) ||
      isAppliedTemplateInactive(thread) ||
      getReplyDraftErrors(thread, user?.name ?? '담임').length > 0
    ) {
      return;
    }

    // Same thread, same position and same text means a duplicate or retried send.
    const submissionKey = `${threadId}:${thread.replies.length}:${nextReply}`;

    if (sentReplyKeysRef.current.has(submissionKey)) {
      return;
    }

    sentReplyKeysRef.current.add(submissionKey);

    const showSentReply = () => {
      setInitialDetailTabRequest(null);
      setInitialOriginalViewerRequest(null);
      setReplyComposerThreadId(null);
      setSelectedThreadId(threadId);
      setSendCompleteThreadId(threadId);
      pushTeacherMessageRoute(threadId, 'detail');
    };

    // The server stores the reply and its history (MESSAGE_SENT); a failure keeps the draft for a retry.
    if (thread.serverComplaintId !== undefined) {
      void serverReply.submit(thread, user?.name ?? '선생님').then((sent) => {
        if (!sent) {
          sentReplyKeysRef.current.delete(submissionKey);
        } else if (replyComposerThreadIdRef.current === threadId) {
          showSentReply();
        } else {
          // The teacher left this composer while sending; stay where they are.
          setToastMessage(`${thread.parentName}님에게 답변을 전송했습니다.`);
        }
      });
      return;
    }

    const templateLabel = getAppliedTemplateLabel(thread);
    const replySource = templateLabel
      ? `공식 템플릿(${templateLabel})`
      : thread.aiDraftGenerated
        ? 'AI 초안 수정본'
        : '직접 작성';
    const sentAt = new Date().toISOString();
    const saved = updateThread(threadId, (current) =>
      appendActivityLogs(
        {
          ...current,
          aiDraftGenerated: false,
          appliedTemplate: undefined,
          draftSavedAt: undefined,
          draftText: '',
          replyDraftTab: undefined,
          replyDrafts: undefined,
          officialTemplateApplied: false,
          latestAt: sentAt,
          latestAtLabel: formatNow(),
          messageDateLabel: current.messageDateLabel ?? formatConversationDate(
            current.replies[0]?.sentAt ?? current.latestAt,
          ),
          latestMessage: nextReply,
          replies: [
            ...current.replies,
            {
              id: `${current.id}-${current.replies.length + 1}`,
              authorName: user?.name ?? '선생님',
              authorRole: 'teacher',
              content: nextReply,
              deliveryStatus: 'SENT_TO_PARENT',
              label: '선생님 답변',
              readByParent: false,
              time: formatConversationTime(sentAt),
              sentAt,
            },
          ],
          needsTeacherReview: false,
          status: 'inProgress',
        },
        [
          ...(templateLabel
            ? [
                {
                  actor: user?.name ?? '선생님',
                  action: '공식 템플릿 채택',
                  detail: `${templateLabel}을 기반으로 한 답변을 최종 답변으로 채택했습니다.`,
                },
              ]
            : []),
          {
            actor: user?.name ?? '선생님',
            action: '답변 전송',
            detail: `교사가 확인한 최종 답변을 학부모에게 전송했습니다(SENT_TO_PARENT). 작성 방식: ${replySource}.`,
          },
        ],
      ),
    );
    if (!saved) {
      sentReplyKeysRef.current.delete(submissionKey);
      return;
    }
    showSentReply();
  };

  const workspaceProps = {
    filters,
    serverList: isServerInbox ? {
      ...serverInbox.listState,
      onLoadMore: serverInbox.loadMore,
      onRetry: serverInbox.retry,
    } : undefined,
    isDetailFilterOpen,
    onDetailFilterToggle: () => setIsDetailFilterOpen((isOpen) => !isOpen),
    onFiltersChange: (nextFilters: Partial<BoardFilters>) =>
      setFilters((current) => ({ ...current, ...nextFilters })),
  };
  const tabItems = [
    {
      value: 'all',
      label: <TabLabel count={filteredThreads.length} label="전체 메시지" />,
      content: (
        <BoardWorkspace
          emptyDescription="검색어 또는 필터 조건을 바꾸면 다른 메시지를 볼 수 있습니다."
          emptyTitle="조건에 맞는 메시지가 없습니다"
          {...workspaceProps}
          onSelect={handleSelectThread}
          onToggleStar={handleToggleStar}
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
          emptyDescription="중요하게 표시한 메시지가 이곳에 모입니다."
          emptyTitle="별표 메시지가 없습니다"
          {...workspaceProps}
          onSelect={handleSelectThread}
          onToggleStar={handleToggleStar}
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
          emptyDescription="작성 중인 답변 초안이 생기면 이곳에 모입니다."
          emptyTitle="임시저장 답변이 없습니다"
          {...workspaceProps}
          onSelect={handleSelectThread}
          onToggleStar={handleToggleStar}
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
          messageCount={activeMessageCount}
          onCollapsedChange={setIsSidebarCollapsed}
          onLogout={handleLogout}
          profileMeta={user?.email}
          profileName={user?.name}
        />
        <main className="board-detail-page">
          <ReplyComposerPage
            onInitializeDraft={handleInitializeDraft}
            onDraftTabChange={handleDraftTabChange}
            onApplyOfficialTemplate={handleApplyOfficialTemplate}
            onBack={() => {
              setInitialOriginalViewerRequest(null);
              setReplyComposerThreadId(null);
              setSelectedThreadId(replyComposerThread.id);
              pushTeacherMessageRoute(replyComposerThread.id, 'detail');
            }}
            onDraftChange={handleDraftChange}
            onTemplateChange={handleTemplateChange}
            onDraftReset={handleDraftReset}
            onDraftSave={handleDraftSave}
            onListOpen={() => {
              setInitialDetailTabRequest(null);
              setInitialOriginalViewerRequest(null);
              setReplyComposerThreadId(null);
              setSelectedThreadId(null);
              pushTeacherMessageRoute();
            }}
            onOpenOriginalPage={handleOpenOriginalPageFromComposer}
            onSubmitReply={handleSubmitReply}
            onGenerateAiDraft={(threadId) => {
              const target = threads.find((thread) => thread.id === threadId);
              if (target) void serverReply.generateAiDraft(target);
            }}
            serverReplyAction={serverReply.pending?.threadId === replyComposerThread.id
              ? serverReply.pending.action
              : null}
            thread={replyComposerThread}
          />
          {toastMessage ? <Toast message={toastMessage} onClose={dismissToast} /> : null}
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
          messageCount={activeMessageCount}
          onCollapsedChange={setIsSidebarCollapsed}
          onLogout={handleLogout}
          profileMeta={user?.email}
          profileName={user?.name}
        />
        <main className="board-detail-page">
          <ThreadDetail
            onConsultationComplete={(threadId) => {
              const target = threads.find((thread) => thread.id === threadId);
              if (target?.serverComplaintId) {
                void completeServerConsultation(target);
                return;
              }
              updateThread(threadId, (thread) => ({ ...thread, status: 'complete', needsTeacherReview: false }));
            }}
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
            onServerStateLoaded={handleServerStateLoaded}
            onReloadServerDetail={isServerInbox ? retryServerDetail : undefined}
            onAdminShared={handleAdminShared}
            onAiObjection={handleAiObjection}
            thread={selectedThread}
          />
          <ReplySendCompleteDialog
            onClose={() => setSendCompleteThreadId(null)}
            open={sendCompleteThreadId === selectedThread.id}
            thread={sendCompleteThread}
          />
          {toastMessage ? <Toast message={toastMessage} onClose={dismissToast} /> : null}
        </main>
      </section>
    );
  }

  return (
    <section className={pageClassName} aria-labelledby="board-page-title">
      <Sidebar
        activeItem="messages"
        defaultCollapsed={isSidebarCollapsed}
        messageCount={activeMessageCount}
        onCollapsedChange={setIsSidebarCollapsed}
        onLogout={handleLogout}
        profileMeta={user?.email}
        profileName={user?.name}
      />
      <main className="board-list-page">
        <h1 className="board-page-title" id="board-page-title">
          받은 메시지
        </h1>

        <section className="board-list-panel" aria-label="메시지 목록">
          {threads.some((thread) => thread.needsTeacherReview) ? <p className="board-follow-up-notice" role="status">
            추가 질문이 도착했습니다. 재확인이 필요한 문의 {threads.filter((thread) => thread.needsTeacherReview).length}건을 확인해 주세요.
          </p> : null}
          <Tabs
            ariaLabel="메시지 분류"
            className="board-tabs"
            items={tabItems}
            onValueChange={(nextValue) => setActiveTab(nextValue as ThreadTab)}
            value={activeTab}
          />
        </section>
      </main>
      {toastMessage ? <Toast message={toastMessage} onClose={dismissToast} /> : null}
      <DraftResumeDialog
        onClose={() => setDraftPromptThreadId(null)}
        onContinue={handleContinueDraft}
        open={draftPromptThread !== null}
      />
    </section>
  );
}
