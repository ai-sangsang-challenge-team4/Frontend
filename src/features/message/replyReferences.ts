import type { BoardThread } from './types';

export type RegulationSource = {
  article: string;
  isOutdated?: boolean;
  organization: string;
  title: string;
  url: string;
  version: string;
};

// Corpus misses and search failures are separate results: only a miss forbids drafting outright.
export type RegulationSearchResult =
  | { sources: RegulationSource[]; status: 'found' }
  | { status: 'not_found' }
  | { status: 'error' };

const mockCorpus: { keywords: string[]; source: RegulationSource }[] = [
  {
    keywords: ['상담'],
    source: { title: '학부모 상담 운영 안내', organization: '학교 A', version: 'v1.2', article: '제3조(상담 운영 시간), 제4조(상담 신청)', url: 'https://example.com/school-a/counseling' },
  },
  {
    keywords: ['친구', '갈등', '쉬는 시간', '생활'],
    source: { title: '학교 생활지도 규정', organization: '학교 A', version: 'v1.2', article: '제7조(학생 간 갈등 확인 절차)', url: 'https://example.com/school-a/guidance' },
  },
  {
    keywords: ['현장체험', '준비물', '도시락'],
    source: { title: '현장체험학습 운영 계획', organization: '학교 A', version: 'v0.9', article: '제5조(준비물 및 안전 수칙)', url: 'https://example.com/school-a/field-trip', isOutdated: true },
  },
  {
    keywords: ['방과후', '결석', '출결'],
    source: { title: '학업성적관리규정', organization: '학교 A', version: 'v2.0', article: '제12조(출결 처리)', url: 'https://example.com/school-a/attendance' },
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
