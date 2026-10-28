import { formatMessageDate } from '../parent-message/conversation';
import type { BoardThread } from './types';
import { riskCategories, type RiskClassification } from '../risk-analysis';

// Explicit demo results for the existing fixtures. Never classify live messages here.
function mockClassifications(overrides: RiskClassification[] = []): RiskClassification[] {
  return riskCategories.map(({ code }) => overrides.find((result) => result.code === code) ?? { code, status: 'ABSENT' });
}

// Mock inbox shown until the message API is connected.
const exampleThreads: BoardThread[] = [
  {
    id: 'thread-001',
    parentName: '최유진 학부모',
    studentName: '최유진',
    className: '3학년 2반',
    title: '상담 일정 및 조치 내용 확인 요청',
    latestMessage: '학부모 상담 가능 일정을 확인하고 조율을 요청',
    latestAt: '2026-08-03T10:24:00+09:00',
    latestAtLabel: formatMessageDate('2026-08-03T10:24:00+09:00'),
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
      riskClassifications: mockClassifications([
        { code: 'EMOTIONAL_EXPRESSION', status: 'PRESENT', evidenceSpan: '저도 너무 불안합니다', rationale: '학부모의 강한 불안이 표현되어 있습니다.' },
        { code: 'UNREASONABLE_DEMAND', status: 'BOUNDARY', evidenceSpan: '오늘 중으로 꼭 연락 주세요', rationale: '당일 연락을 요청하지만 요청의 적절성은 상황 확인이 필요합니다.' },
      ]),
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
          time: formatMessageDate('2026-08-23T10:24:00+09:00'),
          actor: 'AI 분석',
          action: '위험도 산정',
          detail: '시스템 위험도를 긴급으로 분류했습니다.',
        },
        {
          id: 'log-002',
          time: formatMessageDate('2026-08-23T10:25:00+09:00'),
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
    latestAtLabel: formatMessageDate('2026-08-23T09:08:00+09:00'),
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
      riskClassifications: mockClassifications([
        { code: 'EMOTIONAL_EXPRESSION', status: 'BOUNDARY', evidenceSpan: '아이가 계속 속상해합니다', rationale: '학생의 속상함을 전달하는 표현입니다. 교사에 대한 공격으로 단정하지 않습니다.' },
      ]),
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
          time: formatMessageDate('2026-08-23T09:08:00+09:00'),
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
    latestAtLabel: formatMessageDate('2026-08-22T17:20:00+09:00'),
    risk: 'normal',
    status: 'before',
    riskReviewRequired: false,
    draftText: '',
    isPinned: false,
    messageDateLabel: '2026년 8월 22일 토요일',
    originalMessage: '',
    analysis: {
      systemRiskLevel: 'low',
      riskClassifications: riskCategories.map(({ code }) => ({ code, status: 'UNKNOWN' })),
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
          time: formatMessageDate('2026-08-22T17:20:00+09:00'),
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
    latestAtLabel: formatMessageDate('2026-08-22T14:06:00+09:00'),
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
      riskClassifications: mockClassifications(),
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
          time: formatMessageDate('2026-08-22T14:06:00+09:00'),
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
    latestAtLabel: formatMessageDate('2026-08-21T16:48:00+09:00'),
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

// The example threads ship with their AI summary in title/latestMessage; keep it fixed as replies arrive.
export const initialTeacherThreads: BoardThread[] = exampleThreads.map((thread) => ({
  ...thread,
  conversationSummary: thread.conversationSummary ?? { topic: thread.title, text: thread.latestMessage },
}));
