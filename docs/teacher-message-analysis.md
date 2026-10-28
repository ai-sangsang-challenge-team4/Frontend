# 교사 메시지 분석 화면

`/teacher/messages/:messageId`의 기존 대화·위험 요소·처리 기록과 답변 작성 흐름을 유지합니다. 브라우저 탭 제목은 `TeacherHub`입니다.

- AI 최종 위험도는 `analysis.systemRiskLevel`을 표시합니다. 교사가 수정한 값은 별도 표시하고 기존 대응 정책에 적용합니다.
- 일반은 기존 원문 대화, 주의 이상은 완충 요약을 먼저 보여줍니다. 요약 실패·빈 요약은 안내로 대체하고 원문을 자동 노출하지 않습니다. 원문 확인은 기존 열람 권한·확인창·열람 기록을 따릅니다.
- 위험 요소 탭은 8개 표준 분류를 모두 표시합니다. `PRESENT`는 탐지, `ABSENT`는 미탐지, `BOUNDARY`는 경계, `UNKNOWN`은 미확인입니다. 누락·중복·잘못된 분류 상태는 미확인으로 표시합니다.
- 분류 항목을 펼치면 판단 이유와 근거 구간을 확인합니다. 원문 열람 권한이 있을 때만 근거 구간과 원문 이동 버튼을 표시합니다. 기존 추가 판단 근거도 유지합니다.
- 학생 안전 신호의 `NONE`, `POSSIBLE`, `URGENT_REVIEW`와 High 공식 템플릿·Emergency 안전 잠금은 기존 동작을 유지합니다.
- `analysis.status`의 `loading`·`failed`, 잘못된 필수 분석 값, 분석 결과 없음은 각각 안내합니다. 실패·로딩 중에는 답변 생성과 전송을 제한합니다. 기존 분석 없는 Mock 학부모 문의의 답변 흐름은 유지합니다.

## 데이터 연결 범위

현재 교사 메시지 API·AI 분석 API의 주소와 응답 계약은 저장소에 없습니다. 화면은 기존 `initialTeacherThreads`를 사용하며 새 분류 값도 명시적인 예시 데이터입니다. 실제 AI 분석 요청이나 재시도 API는 구현하지 않았습니다.

프론트엔드에서 추가한 선택 필드:

```ts
analysis.status?: 'ready' | 'loading' | 'failed'; // 기존 데이터는 생략 시 ready
analysis.riskClassifications?: {
  code: RiskTagCode; // src/shared/types/risk.ts의 8개 코드
  status: 'PRESENT' | 'ABSENT' | 'BOUNDARY' | 'UNKNOWN';
  rationale?: string;
  evidenceSpan?: string | null; // 원문에서 인용한 문자열
}[];
```

서버 계약이 확정되면 수신 데이터를 이 화면 모델로 변환해야 합니다. 분류를 받지 못했다고 미탐지로 채우거나, 클라이언트에서 위험도를 추정하지 않습니다.

## 검증

`npm run test:auth -- teacher-message-analysis.spec.ts`는 데스크톱·모바일에서 제목, 8개 분류, 근거 원문 이동, 권한 제한, AI와 교사 위험도 구분, 요약 실패, 분석 실패·로딩·잘못된 응답·복구를 확인합니다. 기존 위험도별 답변 정책과 안전 신호는 `teacher-reply-flow.spec.ts`, `privacy-safety.spec.ts`에서 검증합니다.
