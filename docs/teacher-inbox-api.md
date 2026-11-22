# 교사 메시지함 조회 API 연동 (#53)

`VITE_MESSAGE_API=http`이면 교사 메시지함(목록·상세·대화·위험 요소·처리 기록·원문 열람)을 백엔드 `/teacher/complaints` API로 읽습니다. 그 외(기본)는 기존 로컬 메시지함(mock 스레드 + 학부모 메시지 브리지)을 그대로 씁니다. 로컬 메시지함은 서버 DTO가 없어 DTO 형태의 mock 어댑터는 두지 않았습니다.

백엔드는 JWT가 필요하므로 `VITE_AUTH_API=http`와 함께 켭니다. 위험도 검토·관리자 공유·Emergency 재검토까지 실서버로 쓰려면 `VITE_ESCALATION_API=http`도 켭니다. 서버 스레드의 id는 숫자 complaintId라 escalation API가 그대로 동작합니다.

## API

| 화면 | Method | Endpoint | 비고 |
| --- | --- | --- | --- |
| 목록 | GET | `/teacher/complaints?page=&keyword=&status=&riskLevel=&sort=` | 페이지 크기 10 고정, "메시지 더 보기"로 다음 페이지 |
| 상세 | GET | `/teacher/complaints/{id}` | |
| 대화 | GET | `/teacher/complaints/{id}/messages` | 메시지별 `summaryStatus`로 원문·완충 요약·생성 실패 안내 표시 |
| 위험 요소 | GET | `/teacher/complaints/{id}/risk` | 404(분석 없음)는 "분석 실패"로 표시 |
| 처리 기록 | GET | `/teacher/complaints/{id}/history` | 최신순 응답을 오래된 순으로 표시 |
| 원문 열람 | POST | `/teacher/complaints/{id}/messages/{messageId}/original-views` | 메시지 하나의 원문 반환 + 서버가 `ORIGINAL_VIEWED` 기록. 받은 뒤 원문 화면을 엶. 요약 카드마다 그 메시지의 원문을 열고, 위험 요소·답변 작성 화면의 원문 보기는 최신 학부모 메시지(최신 분석 대상)를 엶. `messageId`는 대화의 `message:{id}`에서 숫자만 사용 |
| 사이드바 숫자 | GET | `/teacher/complaints?status=OPEN` 및 `status=ANSWERED` | 두 응답의 `totalElements` 합계 |

메시지를 열면 상세·대화·위험·이력을 함께 불러옵니다. 위험도 검토·관리자 공유·원문 열람 뒤에는 서버 상태(위험도·안전 잠금·이력)를 다시 불러옵니다. 교사가 답변을 전송하면 `ANSWERED / PARENT`를 반영하고 진행 중 상담 목록과 사이드바 수를 다시 조회합니다. 답변 완료(`ANSWERED`)도 상담 종료 전까지 진행 중 상담에 포함됩니다. 민원 종료는 학부모가 처리합니다.

- 같은 메시지의 상세 요청이 겹치면 마지막 요청의 응답만 반영합니다.
- 상세 조회가 실패하면 위험 요소 탭에 "다시 불러오기"를 표시합니다. 처리 기록만 실패하면 마지막으로 불러온 기록을 유지하고 실패 안내와 "다시 시도"를 표시합니다.
- 처리 기록 응답의 `logComplete=false` 또는 비어 있지 않은 `missingLogs`가 있으면 조회된 기록과 함께 누락 안내·항목별 설명·"기록 다시 불러오기"를 표시합니다. 조회 실패와 기록 누락은 별도로 표시합니다.
- 목록 첫 페이지가 실패하면 이전 필터 결과를 비우고 오류 화면을, "더 보기"가 실패하면 그 페이지만 다시 요청합니다.
- 목록을 다시 불러오면 열어 둔 메시지도 제목·상태·위험도 같은 서버 필드는 갱신하고 별표·답변 초안은 유지합니다.

## 필터 매핑

| 화면 | 서버 쿼리 |
| --- | --- |
| 진행 중 상담 / 완료된 상담 / 전체 | 진행 중은 status 없이 조회한 페이지에서 `OPEN`·`ANSWERED`만 표시 / `status=CLOSED` / 없음 |
| 위험도 | `riskLevel` (최신 교사 검토가 있으면 그 등급 기준) |
| 검색 | `keyword` (제목·학생명·학부모명·메시지 내용, 300ms 디바운스, 최대 100자: 서버 `@Size(max = 100)`) |
| 정렬 | 최신순 `LATEST` / 오래된순 `OLDEST`. 위험도순·상담 상태순은 서버에 없어 서버 모드에서는 표시하지 않음 |

진행 중 상담은 서버 정렬과 페이지 순서를 유지합니다. 완료 건만 있는 페이지는 다음 페이지로 넘어가며, 진행 중 건이 있거나 마지막 페이지에 도달하면 표시합니다.

## 응답 → 화면 모델(`BoardThread`)

- 상담 상태: `CLOSED / NONE`은 상담 완료, `ANSWERED / PARENT`는 답변 완료로 표시합니다. 교사 답변 뒤 `OPEN / TEACHER`로 돌아온 추가 문의에는 "재확인 필요"를 표시합니다.
- 위험 분류: 백엔드 `RiskTagCode` 8종과 화면 분류 8종이 1:1입니다(PROFANITY→감정적 표현, INSULT→인신공격, THREAT→위협, LEGAL→법적·행정적 조치, EXPOSURE→공개·유포 위협, REPEAT→반복성, UNFAIR_REQUEST→무리한 요구, PRIVACY→개인정보 위험). `detectedFactors`에 있으면 탐지, 없으면 미탐지입니다.
- 위험 점수(#77, 2026-11-17): 시스템 점수 `riskScore`는 0~100점이며 그대로 표시합니다. 교사는 1~7점(`reviewScale`)을 고르고 서버가 10을 곱해 `reviewScore`(10~70)로 저장합니다. 현재 적용 위험도와 행동 정책은 `currentRiskLevel`을 우선합니다. 처리 기록의 점수는 서버 값을 그대로 표시하며 시스템 점수를 교사 7점 척도로 환산하지 않습니다.
- 잠정 분석: `analysisMode=RULE_ONLY` 또는 `aiAnalysisStatus`가 `REUSED_RULE_ONLY`·`RULE_ONLY_AI_UNAVAILABLE`·`RULE_ONLY_INVALID_RESPONSE`이면 잠정 분석 배지와 직접 검토 안내를 표시하고, `manualReviewRequired=true`를 강조합니다. `analysisMessage`는 설명으로 표시하며 화면 분기 기준으로 사용하지 않습니다. 관리자 공유 상세의 위험 분석도 동일한 안내를 사용합니다. 새 메타데이터가 생략된 이전 응답도 지원합니다.
- 교사 검토 위험도: 검토가 없으면 `reviewScale`·`reviewScore`·`reviewLevel`이 `null`입니다. 화면의 1~7점 슬라이더에는 `reviewScale`을 씁니다.
- 증빙 패키지 가능 여부: `allowedActions`에 `CREATE_EVIDENCE_PACKAGE`가 있을 때.
- 위험도 검토 가능: `status=OPEN`이고 `waitingFor=TEACHER`일 때(백엔드 규칙과 동일).
- 날짜: 서버 `LocalDateTime`은 타임존이 없고 서버 시각이 KST라 `+09:00`을 붙여 해석합니다(`shared/api/serverDateTime.ts`).
- 목록 미리보기는 서버 `aiSummary`를 씁니다. 대화와 답변 작성 화면은 각 학부모 메시지의 `summaryStatus`를 따릅니다. `null`이면 `content`가 원문이므로 바로 보여 주고, `GENERATED`이면 완충 요약 카드와 원문 보기 버튼을 표시합니다. `UNAVAILABLE`이면 합의된 서버 실패 문구를 표시하고 원문 보기 버튼을 제공합니다. 예상과 다른 실패 본문은 고정 안내 문구로 대체합니다.
- 백엔드는 대화 조회 때 HIGH·EMERGENCY 학부모 메시지의 완충 요약을 생성합니다. 이전 응답은 `summaryStatus`가 생략된 경우에만 `summarized`를 사용합니다. 요약 카드의 원문은 기존 확인창과 원문 열람 API를 거쳐 표시합니다.
- 교사 답변의 `status=READ` 또는 `readAt`이 있으면 학부모가 읽은 상태로 표시합니다. 필드가 없는 이전 응답도 지원합니다.
- 처리 기록의 AI 분석 제한·규칙 폴백·AI 초안 정책 차단·답변 정책 차단 이벤트도 한국어 작업명으로 표시합니다.

## 서버 모드에서 로컬 전용인 것

백엔드에 대응 데이터가 없어 브라우저 메모리에만 남고 새로고침하면 사라집니다.

- 별표(고정), AI 판단 이의 제기, 증빙 패키지 생성, 학생 안전 신호(항상 "없음"), 지정 담당자 재검토 요청
- 탭별 답변 초안 상태와 공식 템플릿 입력값(서버에는 현재 탭 내용 하나만 임시저장)

AI 초안·임시저장·답변 전송은 [teacher-reply-api.md](teacher-reply-api.md)(#54)에서 서버에 연결했습니다.

## 백엔드 확인·요청

- `allowedActions`는 백엔드가 위험 등급(잠금 중이면 EMERGENCY)으로 계산합니다. 화면 정책(낮음·주의 AI 초안, 위험 공식 템플릿, 긴급 답변 차단)과 대체로 같지만 `USE_RESPONSE_TEMPLATE`는 LOW·MEDIUM에도 포함됩니다. 지금은 증빙 패키지 가능 여부에만 사용합니다.
- 목록 응답에 최신 메시지 내용이 없어 미리보기에 `aiSummary`를 씁니다.
- `GET /users/me`의 과거 500 임시 우회는 2026-11-17 제거했습니다. 조회 실패는 세션을 보존한 재시도 화면으로 처리합니다([auth-mock-testing.md](auth-mock-testing.md)).
- `POST /close`가 불가능한 상태면 409 `RESPONSE_NOT_EDITABLE`과 구체적인 이유(예: "이미 완료된 민원은 다시 완료 처리할 수 없습니다.")를 줍니다. `RESPONSE_NOT_EDITABLE`은 서버 문구를 우선 표시합니다.

## 테스트

```bash
npx playwright test teacher-inbox-api
```

`teacher-inbox-api.spec.ts`는 fetch를 대체해 요청 경로·쿼리와 응답 변환(상태·위험 분류·교사 검토·완충 요약·이력 순서·생략 필드·KST 시각)을 확인합니다. #77은 분석 메타데이터 보존, 현재 적용 등급 우선, 100점 시스템 점수와 교사 7단계 구분도 확인합니다. 실제 서버 호출은 아닙니다. 기존 화면 연결은 배포 서버(dev 계정)로 수동 확인했습니다: 로그인 → 목록 → 완료 필터·검색 → 상세·대화 → 위험 요소(위협 탐지·잠금·관리자 공유) → 원문 열람 → 처리 기록. 이 과거 확인을 #77의 배포 AI 검증으로 간주하지 않습니다.
