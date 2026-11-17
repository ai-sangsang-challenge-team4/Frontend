# 교사 메시지 분석 화면

`/teacher/messages/:messageId`의 기존 대화·위험 요소·처리 기록과 답변 작성 흐름을 유지합니다. 브라우저 탭 제목은 `TeacherHub`입니다.

- 시스템 분석 위험도는 `analysis.systemRiskLevel`, 시스템 점수는 `analysis.systemRiskScore`의 0~100점을 그대로 표시합니다(#77). 교사 검토는 별도의 1~7단계이며, 대응 정책은 서버의 `analysis.currentRiskLevel`을 우선하고 없으면 기존 교사 검토·시스템 등급 순서를 따릅니다.
- `aiAnalysisStatus`·`analysisMode`로 잠정 분석을 구분하고 `manualReviewRequired=true`이면 직접 검토 안내를 표시합니다. `analysisMessage`는 설명이며 상태 판정에 사용하지 않습니다. 이전 응답에서 새 필드가 생략되면 상태를 임의로 채우지 않습니다.
- 일반은 기존 원문 대화, 주의 이상은 완충 요약을 먼저 보여줍니다. 요약 실패·빈 요약은 안내로 대체하고 원문을 자동 노출하지 않습니다. 원문 확인은 기존 열람 권한·확인창·열람 기록을 따릅니다.
- 위험 요소 탭은 8개 표준 분류를 모두 표시합니다. `PRESENT`는 탐지, `ABSENT`는 미탐지, `BOUNDARY`는 경계, `UNKNOWN`은 미확인입니다. 누락·중복·잘못된 분류 상태는 미확인으로 표시합니다.
- 분류 항목을 펼치면 판단 이유와 근거 구간을 확인합니다. 원문 열람 권한이 있을 때만 근거 구간과 원문 이동 버튼을 표시합니다. 기존 추가 판단 근거도 유지합니다.
- 학생 안전 신호의 `NONE`, `POSSIBLE`, `URGENT_REVIEW`와 High 공식 템플릿·Emergency 안전 잠금은 기존 동작을 유지합니다.
- `analysis.status`의 `loading`·`failed`, 잘못된 필수 분석 값, 분석 결과 없음은 각각 안내합니다. 실패·로딩 중에는 답변 생성과 전송을 제한합니다. 기존 분석 없는 Mock 학부모 문의의 답변 흐름은 유지합니다.

## 데이터 연결 범위

mock 모드는 기존 `initialTeacherThreads`와 명시적인 예시 분류 데이터를 사용합니다. `VITE_MESSAGE_API=http`에서는 [교사 메시지함 API](teacher-inbox-api.md)의 위험 응답을 `serverThreads.ts`가 화면 모델로 변환하며, #77의 분석 메타데이터·시스템 점수·현재 적용 등급도 보존합니다. 교사 화면에서 위험 분석을 새로 실행하는 API는 연결하지 않았습니다.

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

분류를 받지 못했다고 미탐지로 채우거나, 클라이언트에서 위험도를 추정하지 않습니다. HTTP 응답의 `detectedFactors`·상태·근거 변환과 선택 메타데이터는 [교사 메시지함 계약](teacher-inbox-api.md)을 따릅니다.

## 검증

`npm run test:auth -- teacher-message-analysis.spec.ts`는 데스크톱·모바일에서 제목, 8개 분류, 근거 원문 이동, 권한 제한, 시스템과 교사 위험도 구분, 잠정 분석·직접 검토 안내, 요약 실패, 분석 실패·로딩·잘못된 응답·복구를 확인합니다. `teacher-inbox-api.spec.ts`는 새 메타데이터 보존과 현재 적용 등급 우선, 100점 시스템 점수와 교사 검토 7단계 구분을 확인합니다. 기존 위험도별 답변 정책과 안전 신호는 `teacher-reply-flow.spec.ts`, `privacy-safety.spec.ts`에서 검증합니다.
