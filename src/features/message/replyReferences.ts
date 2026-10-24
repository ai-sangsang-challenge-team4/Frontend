import type { BoardThread } from './types';

export type RegulationSource = {
  id: string;
  article: string;
  isExample?: boolean;
  isOutdated?: boolean;
  organization: string;
  title: string;
  url?: string;
  version: string;
  sections: { heading: string; text: string }[];
};

// Corpus misses and search failures are separate results: only a miss forbids drafting outright.
export type RegulationSearchResult =
  | { sources: RegulationSource[]; status: 'found' }
  | { status: 'not_found' }
  | { status: 'error' };

const mockCorpus: { keywords: string[]; source: RegulationSource }[] = [
  {
    keywords: ['상담'],
    source: {
      id: 'counseling-v1.2', title: '학부모 상담 운영 안내', organization: '학교 A', version: 'v1.2', article: '제3조(상담 운영 시간), 제4조(상담 신청)', isExample: true,
      sections: [
        { heading: '제3조(상담 운영 시간)', text: '상담 가능한 시간은 담당 교사의 일정을 확인한 뒤 학부모와 조율합니다. 확정되지 않은 일정은 답변에서 확정된 것처럼 안내하지 않습니다.' },
        { heading: '제4조(상담 신청)', text: '상담을 신청할 때는 문의 주제와 희망 일정을 전달하고 담당자의 확인을 거쳐 일정을 정합니다.' },
      ],
    },
  },
  {
    keywords: ['친구', '갈등', '쉬는 시간', '생활'],
    source: {
      id: 'guidance-v1.2', title: '학교 생활지도 규정', organization: '학교 A', version: 'v1.2', article: '제7조(학생 간 갈등 확인 절차)', isExample: true,
      sections: [{ heading: '제7조(학생 간 갈등 확인 절차)', text: '학생 간 갈등에 관한 문의는 관련 학생의 설명과 관찰 기록을 확인한 뒤 안내합니다. 확인 중인 내용과 확인된 사실을 구분하고 다른 학생의 개인정보가 답변에 포함되지 않도록 검토합니다.' }],
    },
  },
  {
    keywords: ['현장체험', '준비물', '도시락'],
    source: {
      id: 'field-trip-v0.9', title: '현장체험학습 운영 계획', organization: '학교 A', version: 'v0.9', article: '제5조(준비물 및 안전 수칙)', isExample: true, isOutdated: true,
      sections: [{ heading: '제5조(준비물 및 안전 수칙)', text: '준비물은 행사별 안내장을 기준으로 확인합니다. 개인 도시락 지참과 같은 별도 문의는 담당자의 확인 후 안내합니다. 이 예시는 구버전 자료이므로 실제 안내 전 최신 계획을 확인해야 합니다.' }],
    },
  },
  {
    keywords: ['방과후', '결석', '출결'],
    source: {
      id: 'attendance-v2.0', title: '학업성적관리규정', organization: '학교 A', version: 'v2.0', article: '제12조(출결 처리)', isExample: true,
      sections: [{ heading: '제12조(출결 처리)', text: '정규 수업과 방과후 수업의 출결 기록은 해당 수업의 운영 기준을 확인하여 안내합니다. 기록의 변경 여부는 담당자의 확인 없이 약속하지 않습니다.' }],
    },
  },
];

// Mock until the RAG API is connected. Keyword matching stands in for clause retrieval.
export function searchRegulations(thread: BoardThread): RegulationSearchResult {
  if (thread.ragSearchFailed) {
    return { status: 'error' };
  }

  const searchable = [thread.title, thread.latestMessage, thread.originalMessage ?? '', ...thread.replies.map((reply) => reply.content)].join(' ');
  const sources = mockCorpus
    .filter((entry) => entry.keywords.some((keyword) => searchable.includes(keyword)))
    .map((entry) => entry.source);

  return sources.length > 0 ? { status: 'found', sources } : { status: 'not_found' };
}

export function formatRegulationSource(source: RegulationSource) {
  return `${source.title} ${source.version} · ${source.organization} · ${source.article}`;
}
