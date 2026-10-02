import { useEffect, useMemo, useState, type SVGProps } from 'react';
import { Sidebar } from '../../shared/components/teacher-shell/TeacherSidebar';
import { SearchIcon } from '../../shared/components/teacher-shell/icons';
import { Button, EmptyState, TextField } from '../../shared/components/ui';
import {
  emergencyOfficialProcedurePostId,
  replyReferenceGuidePostId,
} from './guidePostIds';
import './TeacherGuide.css';

type GuideCategory = '공지' | '긴급' | '절차' | '답변' | '기록' | '공유';

type GuidePost = {
  category: GuideCategory;
  comments: number;
  date: string;
  id: string;
  title: string;
  views: number;
};

type GuidePostContent = {
  body: string[];
  checks: string[];
};

type GuideAttachment = {
  fileName: string;
  id: string;
};

const noticePosts: GuidePost[] = [
  {
    id: 'notice-urgent-flow',
    category: '공지',
    title: '긴급 단계 메시지 대응 전 필수 확인 사항',
    date: '2026-08-20',
    views: 312,
    comments: 2,
  },
  {
    id: 'notice-template-update',
    category: '공지',
    title: '공식 응답 템플릿 개정 안내',
    date: '2026-08-18',
    views: 246,
    comments: 1,
  },
];

const guidePosts: GuidePost[] = [
  {
    id: emergencyOfficialProcedurePostId,
    category: '긴급',
    title: '긴급 단계 메시지 공식 대응 절차',
    date: '2026-08-21',
    views: 184,
    comments: 0,
  },
  {
    id: replyReferenceGuidePostId,
    category: '답변',
    title: '상담 운영 시간 규정 확인 후 답변 작성 가이드',
    date: '2026-08-14',
    views: 151,
    comments: 0,
  },
  {
    id: 'guide-025',
    category: '긴급',
    title: '학생 안전 신호가 포함된 메시지 대응 절차',
    date: '2026-08-13',
    views: 128,
    comments: 4,
  },
  {
    id: 'guide-024',
    category: '절차',
    title: '위험 단계 판단 후 관리자 공유 기준',
    date: '2026-08-12',
    views: 96,
    comments: 2,
  },
  {
    id: 'guide-023',
    category: '답변',
    title: '학부모 상담 일정 조율 답변 작성 예시',
    date: '2026-08-11',
    views: 84,
    comments: 1,
  },
  {
    id: 'guide-022',
    category: '기록',
    title: '원문 열람 기록을 남겨야 하는 상황',
    date: '2026-08-10',
    views: 73,
    comments: 0,
  },
  {
    id: 'guide-021',
    category: '답변',
    title: '반복 민원 표현을 낮추는 문장 구성',
    date: '2026-08-09',
    views: 67,
    comments: 3,
  },
  {
    id: 'guide-020',
    category: '절차',
    title: '완충 요약 확인 후 원문을 열람하는 순서',
    date: '2026-08-08',
    views: 62,
    comments: 0,
  },
  {
    id: 'guide-019',
    category: '공유',
    title: '생활지도부에 공유할 때 포함할 항목',
    date: '2026-08-07',
    views: 59,
    comments: 2,
  },
  {
    id: 'guide-018',
    category: '긴급',
    title: '답변 작성이 제한되는 긴급 단계 체크리스트',
    date: '2026-08-06',
    views: 112,
    comments: 5,
  },
  {
    id: 'guide-017',
    category: '기록',
    title: '증빙 패키지 생성 후 검토할 내용',
    date: '2026-08-05',
    views: 55,
    comments: 0,
  },
  {
    id: 'guide-016',
    category: '답변',
    title: '오해 가능성을 낮추는 사실 확인 문장',
    date: '2026-08-04',
    views: 49,
    comments: 1,
  },
  {
    id: 'guide-015',
    category: '절차',
    title: '위험도 하향 검토 사유 작성 방법',
    date: '2026-08-03',
    views: 47,
    comments: 2,
  },
  {
    id: 'guide-014',
    category: '공유',
    title: '학년 부장에게 공유하기 전 확인할 기록',
    date: '2026-08-02',
    views: 42,
    comments: 0,
  },
  {
    id: 'guide-013',
    category: '답변',
    title: '현장체험학습 문의 답변 템플릿',
    date: '2026-08-01',
    views: 38,
    comments: 0,
  },
  {
    id: 'guide-012',
    category: '기록',
    title: '상담 완료 후 처리 기록 점검',
    date: '2026-07-31',
    views: 41,
    comments: 1,
  },
  {
    id: 'guide-011',
    category: '긴급',
    title: '학생 정서 위험 신호 표현별 대응 메모',
    date: '2026-07-30',
    views: 91,
    comments: 3,
  },
  {
    id: 'guide-010',
    category: '절차',
    title: '원문 확인 권한이 없을 때의 처리 흐름',
    date: '2026-07-29',
    views: 36,
    comments: 0,
  },
  {
    id: 'guide-009',
    category: '답변',
    title: '방과후 수업 출결 문의 답변 예시',
    date: '2026-07-28',
    views: 34,
    comments: 0,
  },
  {
    id: 'guide-008',
    category: '공유',
    title: '관리자 공유 요청 후 후속 확인 방법',
    date: '2026-07-27',
    views: 33,
    comments: 2,
  },
  {
    id: 'guide-007',
    category: '기록',
    title: 'AI 위험 판단 근거를 검토하는 기준',
    date: '2026-07-26',
    views: 44,
    comments: 1,
  },
  {
    id: 'guide-006',
    category: '답변',
    title: '민감한 가정 상황 언급 시 답변 원칙',
    date: '2026-07-25',
    views: 52,
    comments: 2,
  },
  {
    id: 'guide-005',
    category: '절차',
    title: '상담 전 단계에서 먼저 확인할 정보',
    date: '2026-07-24',
    views: 39,
    comments: 0,
  },
  {
    id: 'guide-004',
    category: '공유',
    title: '공유 완료 후 학부모에게 안내할 범위',
    date: '2026-07-23',
    views: 31,
    comments: 1,
  },
  {
    id: 'guide-003',
    category: '답변',
    title: '친구 갈등 문의에 대한 확인 중심 답변',
    date: '2026-07-22',
    views: 35,
    comments: 0,
  },
  {
    id: 'guide-002',
    category: '기록',
    title: '상담 중 메모를 처리 기록으로 옮기는 방법',
    date: '2026-07-21',
    views: 27,
    comments: 0,
  },
  {
    id: 'guide-001',
    category: '절차',
    title: '일반 단계 메시지의 기본 대응 흐름',
    date: '2026-07-20',
    views: 29,
    comments: 1,
  },
];

const pageSize = 5;
const allGuidePosts = [...noticePosts, ...guidePosts];

const guidePostContentByCategory: Record<GuideCategory, GuidePostContent> = {
  공지: {
    body: [
      '최근 변경된 대응 기준을 확인하고 현재 처리 중인 메시지에 적용되는지 먼저 점검합니다.',
      '기존에 작성해 둔 답변 초안이나 공식 템플릿이 있다면 변경된 기준에 맞게 다시 확인합니다.',
    ],
    checks: [
      '적용 대상과 적용일 확인',
      '기존 초안 또는 처리 기록 영향 여부 확인',
      '필요 시 관리자 또는 관련 부서 확인',
    ],
  },
  긴급: {
    body: [
      '학생 안전 신호가 포함된 메시지는 개별 답변보다 안전 확인과 공식 대응 절차가 우선입니다.',
      '완충 요약, 원문, 위험 요소를 함께 확인하고 필요한 조치를 처리 기록에 남깁니다.',
    ],
    checks: [
      '학생 안전 신호 또는 위해 가능성 표현 확인',
      '답변 작성 잠금 상태와 위험도 검토 상태 확인',
      '관리자 공유 및 오프라인 후속 조치 확인',
    ],
  },
  절차: {
    body: [
      '현재 위험 단계와 메시지 상태를 기준으로 원문 확인, 위험도 검토, 답변 작성 순서를 분리해 진행합니다.',
      '단계가 바뀌거나 예외 처리가 필요한 경우 변경 사유와 시각을 함께 남깁니다.',
    ],
    checks: [
      '현재 메시지 상태와 위험 단계 확인',
      '필수 확인 자료 누락 여부 확인',
      '처리 완료 후 기록 저장 여부 확인',
    ],
  },
  답변: {
    body: [
      '학부모에게 보낼 답변은 확인된 사실과 확인 예정인 사항을 구분해 작성합니다.',
      '단정적인 표현이나 민감 정보 노출을 피하고, 교사가 최종 검토한 내용만 전송합니다.',
    ],
    checks: [
      '학부모 요청에 직접 답하는 문장 포함',
      '확인 전 단정 표현 제거',
      '전송 전 최종 검토 완료',
    ],
  },
  기록: {
    body: [
      '원문 열람, 위험도 검토, 초안 저장처럼 추후 확인이 필요한 행동은 수행자와 시각을 남깁니다.',
      '상담 완료 전 처리 기록에 누락된 항목이 없는지 다시 확인합니다.',
    ],
    checks: [
      '행동, 수행자, 시각 기록 확인',
      '위험도 변경 또는 원문 열람 사유 확인',
      '증빙 패키지 포함 항목 확인',
    ],
  },
  공유: {
    body: [
      '관리자나 관련 부서에 공유할 때는 필요한 정보만 정리하고 민감 정보는 목적에 맞게 최소화합니다.',
      '공유 이후 확인 결과와 후속 조치를 다시 처리 기록에 남깁니다.',
    ],
    checks: [
      '공유 대상과 목적 확인',
      '위험 요약과 요청 사항 정리',
      '공유 후 후속 확인 시각 기록',
    ],
  },
};

const guidePostContentById: Record<string, GuidePostContent> = {
  [emergencyOfficialProcedurePostId]: {
    body: [
      '긴급 단계에서는 개별 답변 초안보다 학생 안전 확인, 증빙 보존, 학교 공식 대응 절차 진행이 우선입니다.\n완충 요약, 원문, 위험 요소를 함께 확인하고 아래 순서대로 처리한 뒤 수행 결과를 처리 기록에 남깁니다.',
      '1. 증빙 즉시 보존\n해당 메시지와 관련 자료를 즉시 증빙 보관합니다. 삭제하거나 수정하지 않고 원본 그대로 보존해야 합니다.',
      '2. 원문 및 이력 확인\n메시지의 전체 내용, 발신자 정보, 이전 대화 이력을 확인해 상황을 정확히 파악합니다.',
      '3. 학교 공식 대응 절차 확인\n학교 및 교육청의 공식 매뉴얼에 따라 대응 절차와 보고 체계를 확인하고 따릅니다. 공식 대응 매뉴얼 URL이 등록되기 전까지는 내부 공지와 지정 담당자 안내를 우선 확인합니다.',
      '4. 담당 관리자/부서 연락 검토\n필요 시 즉시 담당 관리자 또는 관련 부서에 상황을 공유하고 후속 조치를 협의합니다.',
    ],
    checks: [
      '학생 안전 신호와 긴급 판단 근거 확인',
      '원문 열람 기록과 증빙 패키지 보존 상태 확인',
      '학교 및 교육청 공식 매뉴얼의 보고 체계 확인',
      '담당 관리자 또는 관련 부서 공유 필요 여부 검토',
      '후속 조치와 공유 내용을 처리 기록에 저장',
    ],
  },
  [replyReferenceGuidePostId]: {
    body: [
      '답변 작성 화면의 관련 규정 및 근거에서 확인하는 예시 가이드입니다.\n상담 운영 시간과 상담 신청 절차를 안내할 때는 규정 조항을 그대로 나열하기보다, 학부모가 다음 행동을 알 수 있도록 가능한 시간대와 신청 방법을 함께 적습니다.\n답변 전에는 메시지의 위험 단계와 학생 안전 신호 여부를 먼저 확인하고, 필요한 경우 원문과 처리 기록을 함께 검토합니다.',
    ],
    checks: [
      '상담 운영 가능 시간과 신청 절차를 구분해 안내',
      '확정되지 않은 일정은 단정하지 않고 확인 예정 시점 표시',
      '답변 전송 전 교사가 최종 문구와 민감 정보 포함 여부 확인',
    ],
  },
};

function getGuidePostContent(post: GuidePost) {
  return guidePostContentById[post.id] ?? guidePostContentByCategory[post.category];
}

function getGuidePostIdFromLocation() {
  if (typeof window === 'undefined') {
    return null;
  }

  return new URLSearchParams(window.location.search).get('post');
}

function pushTeacherGuideRoute(postId?: string | null) {
  if (typeof window === 'undefined') {
    return;
  }

  const path = postId
    ? `/teacher/guide?post=${encodeURIComponent(postId)}`
    : '/teacher/guide';

  window.history.pushState(window.history.state, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function findGuidePostById(postId: string | null) {
  if (!postId) {
    return null;
  }

  return allGuidePosts.find((post) => post.id === postId) ?? null;
}

function shouldShowGuidePageBackButton() {
  if (typeof window === 'undefined') {
    return false;
  }

  const state = window.history.state as {
    showGuideBackButton?: unknown;
  } | null;

  return state?.showGuideBackButton === true;
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

function BackIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 16 15"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M3.825 8.24079 9.425 13.3684 8 14.6503 0 7.32515 8 0l1.425 1.2819-5.6 5.1276H16v1.83129H3.825Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PaginationIcon({
  direction,
  double = false,
}: {
  direction: 'next' | 'previous';
  double?: boolean;
}) {
  const path = double
    ? 'M10.7 6.7 9.3 5.3 2.6 12l6.7 6.7 1.4-1.4L5.4 12l5.3-5.3Zm9 0-1.4-1.4-6.7 6.7 6.7 6.7 1.4-1.4-5.3-5.3 5.3-5.3Z'
    : 'M15.7 6.7 14.3 5.3 7.6 12l6.7 6.7 1.4-1.4-5.3-5.3 5.3-5.3Z';
  const transform =
    direction === 'next' ? 'translate(24 0) scale(-1 1)' : undefined;

  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d={path} fill="currentColor" transform={transform} />
    </svg>
  );
}

function DownloadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 13 13"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M6.5 9.75 2.4375 5.6875 3.575 4.5094 5.6875 6.6219V0h1.625v6.6219l2.1125-2.1125 1.1375 1.1781L6.5 9.75ZM1.625 13c-.4469 0-.8294-.1591-1.1477-.4773C.1591 12.2044 0 11.8219 0 11.375V8.9375h1.625V11.375h9.75V8.9375H13v2.4375c0 .4469-.1591.8294-.4773 1.1477-.3183.3182-.7008.4773-1.1477.4773H1.625Z"
        fill="currentColor"
      />
    </svg>
  );
}

function formatGuidePostDate(date: string) {
  const weekday = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
  }).format(new Date(`${date}T00:00:00+09:00`));

  return `${date} (${weekday})`;
}

function getGuideAttachments(post: GuidePost): GuideAttachment[] {
  return [
    {
      id: `${post.id}-detail`,
      fileName: `${post.title} 상세 안내 자료.pdf`,
    },
    {
      id: `${post.id}-summary`,
      fileName: `${post.title} 핵심 요약본.pdf`,
    },
    {
      id: `${post.id}-checklist`,
      fileName: `${post.category} 단계별 확인 체크리스트.pdf`,
    },
  ];
}

function GuidePostRow({
  indexLabel,
  onSelect,
  post,
}: {
  indexLabel: string;
  onSelect: (post: GuidePost) => void;
  post: GuidePost;
}) {
  return (
    <button
      aria-label={`${post.title} 게시글 열기`}
      className="guide-board-row"
      onClick={() => onSelect(post)}
      type="button"
    >
      <span className="guide-board-cell guide-board-number">
        {post.category === '공지' ? (
          <span className="guide-notice-badge">공지</span>
        ) : (
          indexLabel
        )}
      </span>
      <span className="guide-board-title-cell">
        <span className="guide-board-title">
          {post.title}
          {post.comments > 0 ? (
            <span className="guide-comment-count">[{post.comments}]</span>
          ) : null}
        </span>
      </span>
      <time className="guide-board-cell" dateTime={post.date}>
        {post.date}
      </time>
      <span className="guide-board-cell">{post.views}</span>
    </button>
  );
}

function GuidePostDetail({
  onBack,
  onSelect,
  post,
}: {
  onBack: () => void;
  onSelect: (post: GuidePost) => void;
  post: GuidePost;
}) {
  const content = getGuidePostContent(post);
  const attachments = getGuideAttachments(post);
  const postIndex = allGuidePosts.findIndex(
    (currentPost) => currentPost.id === post.id,
  );
  const previousPost = postIndex > 0 ? allGuidePosts[postIndex - 1] : null;
  const nextPost =
    postIndex >= 0 && postIndex < allGuidePosts.length - 1
      ? allGuidePosts[postIndex + 1]
      : null;

  return (
    <article className="guide-post-detail" aria-labelledby="guide-post-title">
      <div className="guide-post-detail-header">
        <h2 id="guide-post-title">{post.title}</h2>
        <div className="guide-post-date">
          <span>등록일</span>
          <time dateTime={post.date}>{formatGuidePostDate(post.date)}</time>
        </div>
      </div>

      <div className="guide-post-content">
        <p className="guide-post-intro">
          {post.title}을 위한 대응 가이드라인을 아래와 같이 안내합니다.
        </p>
        {content.body.map((paragraph) => (
          <p className="guide-post-body-paragraph" key={paragraph}>
            {paragraph}
          </p>
        ))}

        <section>
          <h3>확인 사항</h3>
          <ol>
            {content.checks.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>
      </div>

      <section className="guide-post-attachments" aria-label="첨부 파일">
        <h3>첨부 파일</h3>
        <ul>
          {attachments.map((attachment) => (
            <li key={attachment.id}>
              <span>{attachment.fileName}</span>
              <button type="button">
                <span>다운로드</span>
                <DownloadIcon />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <nav className="guide-post-sibling-nav" aria-label="이전글과 다음글">
        <button
          disabled={!previousPost}
          onClick={() => {
            if (previousPost) {
              onSelect(previousPost);
            }
          }}
          type="button"
        >
          <PaginationIcon direction="previous" />
          <span>
            <small>이전글</small>
            <strong>{previousPost?.title ?? '이전글이 없습니다'}</strong>
          </span>
        </button>
        <span className="guide-post-sibling-divider" aria-hidden="true" />
        <button
          disabled={!nextPost}
          onClick={() => {
            if (nextPost) {
              onSelect(nextPost);
            }
          }}
          type="button"
        >
          <span>
            <small>다음글</small>
            <strong>{nextPost?.title ?? '다음글이 없습니다'}</strong>
          </span>
          <PaginationIcon direction="next" />
        </button>
      </nav>

      <div className="guide-post-actions">
        <button className="guide-post-list-button" onClick={onBack} type="button">
          목록
        </button>
      </div>
    </article>
  );
}

export function TeacherGuide() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPost, setSelectedPost] = useState<GuidePost | null>(() =>
    typeof window === 'undefined'
      ? null
      : findGuidePostById(getGuidePostIdFromLocation()),
  );
  const [shouldShowPageBack, setShouldShowPageBack] = useState(
    shouldShowGuidePageBackButton,
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filteredNoticePosts = useMemo(() => {
    if (!normalizedQuery) {
      return noticePosts;
    }

    return noticePosts.filter((post) =>
      `${post.category} ${post.title} ${getGuidePostContent(post).body.join(' ')}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [normalizedQuery]);
  const filteredGuidePosts = useMemo(() => {
    if (!normalizedQuery) {
      return guidePosts;
    }

    return guidePosts.filter((post) =>
      `${post.category} ${post.title} ${getGuidePostContent(post).body.join(' ')}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [normalizedQuery]);
  const totalPages = Math.max(1, Math.ceil(filteredGuidePosts.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safePage - 1) * pageSize;
  const visibleGuidePosts = filteredGuidePosts.slice(
    pageStartIndex,
    pageStartIndex + pageSize,
  );
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);
  const hasRows = filteredNoticePosts.length > 0 || visibleGuidePosts.length > 0;
  const pageClassName = `board-inbox-page guide-page-shell${
    isSidebarCollapsed ? ' is-sidebar-collapsed' : ''
  }`;

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setCurrentPage(1);
  };
  const handleSelectPost = (post: GuidePost) => {
    setSelectedPost(post);
    pushTeacherGuideRoute(post.id);
  };
  const handleBackToList = () => {
    setSelectedPost(null);
    pushTeacherGuideRoute();
  };
  const handlePageBack = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.history.pushState(null, '', '/teacher/messages');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  useEffect(() => {
    const handlePopState = () => {
      setSelectedPost(findGuidePostById(getGuidePostIdFromLocation()));
      setShouldShowPageBack(shouldShowGuidePageBackButton());
    };

    window.addEventListener('popstate', handlePopState);

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <section className={pageClassName} aria-labelledby="guide-page-title">
      <Sidebar
        activeItem="guide"
        defaultCollapsed={isSidebarCollapsed}
        messageCount={2}
        onCollapsedChange={setIsSidebarCollapsed}
      />

      <main className="guide-page-main">
        <header className="guide-page-header">
          <div className="guide-page-title-group">
            {shouldShowPageBack ? (
              <button
                className="guide-back-link"
                onClick={handlePageBack}
                type="button"
                aria-label="이전 화면으로 돌아가기"
              >
                <BackIcon />
              </button>
            ) : null}
            <h1 id="guide-page-title">대응 가이드</h1>
          </div>

          <nav aria-label="현재 위치" className="guide-page-nav">
            <a href="/teacher/messages">홈</a>
            <BreadcrumbSeparator />
            {selectedPost ? (
              <>
                <button onClick={handleBackToList} type="button">
                  대응 가이드
                </button>
                <BreadcrumbSeparator />
                <span aria-current="page">게시글</span>
              </>
            ) : (
              <span aria-current="page">대응 가이드</span>
            )}
          </nav>
        </header>

        {selectedPost ? (
          <GuidePostDetail
            onBack={handleBackToList}
            onSelect={handleSelectPost}
            post={selectedPost}
          />
        ) : (
          <>
            <section className="guide-page-summary" aria-live="polite">
              <h2>
                총 <strong>{guidePosts.length}개</strong>의 글이 등록되어
                있습니다.
              </h2>
            </section>

            <section className="guide-board-toolbar" aria-label="대응 가이드 검색">
              <p>
                {normalizedQuery
                  ? `검색 결과 ${
                      filteredNoticePosts.length + filteredGuidePosts.length
                    }`
                  : `전체 ${guidePosts.length}`}
              </p>
              <TextField
                aria-label="대응 가이드 검색"
                containerClassName="guide-search-field"
                onChange={(event) =>
                  handleQueryChange(event.currentTarget.value)
                }
                placeholder="제목 또는 본문 내용으로 검색"
                trailingIcon={<SearchIcon />}
                type="search"
                value={query}
              />
            </section>

            <section className="guide-board" aria-label="대응 가이드 게시글 목록">
              <div className="guide-board-head" aria-hidden="true">
                <span>번호</span>
                <span>제목</span>
                <span>등록일</span>
                <span>조회</span>
              </div>

              {hasRows ? (
                <div className="guide-board-body">
                  {filteredNoticePosts.map((post) => (
                    <GuidePostRow
                      indexLabel="공지"
                      key={post.id}
                      onSelect={handleSelectPost}
                      post={post}
                    />
                  ))}
                  {visibleGuidePosts.map((post) => (
                    <GuidePostRow
                      indexLabel={String(
                        guidePosts.length - guidePosts.indexOf(post),
                      )}
                      key={post.id}
                      onSelect={handleSelectPost}
                      post={post}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  className="guide-empty-state"
                  description="검색어를 바꾸면 다른 대응 가이드를 볼 수 있습니다."
                  title="조건에 맞는 게시글이 없습니다"
                />
              )}
            </section>

            <nav className="guide-pagination" aria-label="대응 가이드 페이지">
              <Button
                aria-label="첫 페이지"
                className="guide-pagination-arrow"
                disabled={safePage === 1}
                onClick={() => setCurrentPage(1)}
                size="sm"
                variant="outline"
              >
                <PaginationIcon direction="previous" double />
                <span className="sr-only">첫 페이지</span>
              </Button>
              <Button
                aria-label="이전 페이지"
                className="guide-pagination-arrow"
                disabled={safePage === 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                size="sm"
                variant="outline"
              >
                <PaginationIcon direction="previous" />
                <span className="sr-only">이전 페이지</span>
              </Button>

              <div className="guide-pagination-pages">
                {pageNumbers.map((pageNumber) => (
                  <button
                    aria-current={safePage === pageNumber ? 'page' : undefined}
                    className={safePage === pageNumber ? 'is-active' : undefined}
                    key={pageNumber}
                    onClick={() => setCurrentPage(pageNumber)}
                    type="button"
                  >
                    {pageNumber}
                  </button>
                ))}
              </div>

              <Button
                aria-label="다음 페이지"
                className="guide-pagination-arrow"
                disabled={safePage === totalPages}
                onClick={() =>
                  setCurrentPage((page) => Math.min(totalPages, page + 1))
                }
                size="sm"
                variant="outline"
              >
                <PaginationIcon direction="next" />
                <span className="sr-only">다음 페이지</span>
              </Button>
              <Button
                aria-label="마지막 페이지"
                className="guide-pagination-arrow"
                disabled={safePage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
                size="sm"
                variant="outline"
              >
                <PaginationIcon direction="next" double />
                <span className="sr-only">마지막 페이지</span>
              </Button>
            </nav>
          </>
        )}
      </main>
    </section>
  );
}
