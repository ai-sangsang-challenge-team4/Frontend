# 관리자 공유 및 처리 (#10)

교사가 긴급(EMERGENCY) 메시지를 관리자에게 공유하고, 관리자가 처리 상태를 `SHARED → UNDER_REVIEW → COMPLETED`로 변경하는 흐름입니다. 교사의 긴급 단계 하향 요청은 공유와 **독립된** Emergency 재검토 요청(`/emergency-review`)으로 지정 검토자(관리자)의 승인·거부를 거칩니다.

상태값과 API는 백엔드 `dev` 브랜치 컨트롤러·DTO 기준입니다(Swagger와 다르면 코드 우선). 프론트에서 다른 값으로 변환하지 않습니다.

## 상태값

| 축 | 타입 | 값 |
| --- | --- | --- |
| 관리자 공유 | `EscalationStatus` | `NOT_SHARED · SHARED · UNDER_REVIEW · COMPLETED` |
| Emergency 재검토 | `RiskReviewStatus` | `PENDING_ADMIN_APPROVAL · APPLIED · REJECTED` |
| 안전 잠금 | `safetyLock` | `true`면 위험도와 관계없이 교사 화면에 긴급 단계 정책 적용 |
| 민원 | `ComplaintStatus` | `DRAFT · OPEN · CLOSED` |
| 메시지 | `MessageStatus` | `DRAFT · SENT · READ` |

학부모 작성 화면의 `PARENT_REVIEW`는 서버 상태가 아닌 로컬 작성 단계(`MessageDraftStep`)입니다.

## Mock / HTTP 전환

`VITE_ESCALATION_API=http`이면 백엔드를 호출하고, 그 외(기본)는 localStorage mock(`teacher-hub.escalations.v3`, `teacher-hub.emergency-reviews.v1`)을 씁니다.

- 백엔드는 JWT가 필요하므로 `VITE_AUTH_API=http`와 함께 켭니다. mock 로그인 토큰으로는 401이 납니다.
- 교사 메시지함은 mock 데이터(`thread-001` 같은 문자열 ID)라, http 모드에서는 숫자 complaintId가 없는 메시지에 요청을 보내지 않고 안내 문구만 표시합니다.

## 화면

| 역할 | 경로 | 내용 |
| --- | --- | --- |
| TEACHER | `/teacher/messages/:id` → 위험 요소 탭 | 위험·긴급 메시지에 `관리자 공유` 섹션. 공유 버튼은 서버 `currentRiskLevel`이 EMERGENCY일 때만 활성. 공유 후 상태 칩, 현재 위험도, 위험도 변경 요청 상태 표시 |
| TEACHER | 같은 탭 → 위험도 검토 | 1~7점 검토를 `risk-reviews`로 저장. 현재 EMERGENCY에서 점수를 바꾸면 공유 여부와 관계없이 Emergency 재검토 요청이 생기고 응답은 `PENDING_ADMIN_APPROVAL`·`safetyLock: true`·`emergencyReviewRequestId`(이때 `riskReviewId` 없음). 승인 대기 중이거나 잠금이 유지되는 동안(EMERGENCY 기준)은 안내 문구와 함께 저장·재검토 요청 버튼을 막습니다(서버 409 `EMERGENCY_REVIEW_DUPLICATE`) |
| TEACHER | 같은 탭 → 관리자 공유 섹션 | 공유 상태, 현재 위험도, 재검토 요청 상태, 안전 잠금 표시. 서버 `safetyLock`이 true면 답변 작성 잠금 유지 |
| TEACHER | `/teacher/admin-share` | 내가 공유한 목록. **mock 전용** (대응 API 없음, http 모드에서는 안내 문구) |
| ADMIN | `/admin/messages` | 공유받은 목록. 상태 탭(전체·확인 대기·검토 중·처리 완료), 위험도 필터 |
| ADMIN | `/admin/messages/:escalationId` | 처리 상태(검토 시작·처리 완료), Emergency 재검토 요청 내용(이전→요청 위험도, 사유)과 승인/거부, 안전 잠금 해제, 공유 내용, 위험 분석, 처리 기록 |

관리자 버튼 노출 조건(최종 판단은 백엔드 409):

- 검토 시작: `escalationStatus === 'SHARED'`
- 처리 완료: `escalationStatus === 'UNDER_REVIEW' && riskReviewStatus !== 'PENDING_ADMIN_APPROVAL'` (승인 대기면 서버 409 `ESCALATION_STATE_INVALID`)
- 위험도 변경 승인/거부: `emergencyReviewRequestId !== null && riskReviewStatus === 'PENDING_ADMIN_APPROVAL'` → `PATCH /admin/emergency-review/{requestId}` `{ status, message }`. 공유 상태와 무관
- 안전 잠금 해제: 결정 후 `safetyLock === true`일 때 → `PATCH … { safetyLock: false }`. **승인해도 잠금은 자동 해제되지 않습니다.** 서버는 승인 대기 중 해제도 받지만 UI는 결정을 먼저 요구합니다

처리 메모(검토 시작·처리 완료)는 필수입니다(백엔드 `@NotBlank`). 재검토 결정 사유는 백엔드에서 선택이지만 기록을 남기도록 UI에서 필수로 받습니다.

### 관리자 상세 응답 표시

- 공유 메시지의 `status`(작성 중·전송됨·읽음), `readAt`(읽은 시각)을 표시합니다. 이전 서버에서 필드가 생략되면 표시하지 않습니다.
- 위험 요소는 `state`의 탐지·미탐지·경계·미확인 상태와 `evidenceSpans[].text`의 근거 구간을 표시합니다. 이전 서버의 단일 `evidence`도 지원하며, 명시적으로 빈 `evidenceSpans`가 오면 이전 근거로 대체하지 않습니다. 같은 응답을 사용하는 교사 화면에도 상태를 반영하며, 원문 하이라이트가 정확한 텍스트 일치로 동작하므로 교사 화면에는 첫 번째 근거 구간만 표시합니다.
- 처리 이력의 `logComplete: false` 또는 비어 있지 않은 `missingLogs`가 있으면 누락 안내와 해당 항목을 표시합니다. 이력이 비어 있어도 누락 안내를 유지하며, 이벤트의 민원 상태 변경과 `referenceType`·`referenceId`에 따른 관련 항목을 함께 표시합니다.
- 시간대가 없는 서버 시각은 KST로 해석합니다.

## API

| 기능 | Method | Endpoint |
| --- | --- | --- |
| 공유 상태 조회(교사) | GET | `/teacher/complaints/{complaintId}/escalation` |
| 공유 요청(교사) | POST | `/teacher/complaints/{complaintId}/escalation` (201, 본문 string → 상태 재조회) |
| 위험도 검토(교사) | POST | `/teacher/complaints/{complaintId}/risk-reviews` |
| 공유 목록(관리자) | GET | `/admin/escalations?status=&riskLevel=` |
| 공유 상세(관리자) | GET | `/admin/escalations/{escalationId}` |
| 공유 메시지·위험·이력 | GET | `/admin/escalations/{escalationId}/messages`, `/risk`, `/history` |
| 검토 시작 / 완료 | POST | `/admin/escalations/{escalationId}/review`, `/complete` |
| Emergency 재검토 요청(교사) | POST | `/teacher/complaints/{complaintId}/emergency-review` (201, Swagger에는 200) |
| 최근 재검토 요청(교사) | GET | `/teacher/complaints/{complaintId}/emergency-review/current` (요청이 없으면 404 `EMERGENCY_REVIEW_NOT_FOUND` → 프론트에서 `null`) |
| 재검토 목록·상세(관리자, 지정 검토자) | GET | `/admin/emergency-review`, `/admin/emergency-review/{requestId}` |
| 재검토 결정·잠금 변경(관리자) | PATCH | `/admin/emergency-review/{requestId}` `{ status?, safetyLock?, message? }` |

~~`POST /admin/escalations/{escalationId}/risk-change-decision`~~ 는 백엔드에서 삭제되었습니다.

409와 서버 사유가 구체적인 코드(`ESCALATION_STATE_INVALID`, `EMERGENCY_REVIEW_DUPLICATE`, `RISK_REVIEW_NOT_ALLOWED` 등)는 백엔드 `ErrorResponse.message`를 그대로 보여 줍니다(`apiError.ts`의 `SERVER_MESSAGE_FIRST_CODES`).

## 백엔드 확인·추가 요청

- 교사의 "내가 공유한 목록" API가 없습니다(`/teacher/admin-share`는 mock 전용). **엔드포인트 추가 필요.**
- 미공유 상태 응답은 `escalationId`가 `null`이고, 재검토 요청이 없으면 `emergencyReviewRequestId`·`riskReviewStatus`도 `null`입니다. 완료된 분석이 없으면 `currentRiskScore`·`currentRiskLevel`도 `null`입니다(백엔드 dev 코드로 확인).
- `SHARED → COMPLETED` 직접 완료는 불가합니다(백엔드 코드로 확인). 재검토 결정은 공유 상태와 무관합니다.
- 관리자 화면은 공유받은 건의 상세에서만 재검토 요청을 보여 줍니다. 공유되지 않은 민원의 재검토 요청(지정 검토자 = 첫 관리자)을 볼 화면은 아직 없습니다(`listAdminEmergencyReviews`는 어댑터에만 있음).
- 관리자 목록·상세 응답에 민원 제목·학생·학급 정보가 없어 `민원 #{complaintId}`와 공유 교사(`sharedBy`)만 표시합니다.
- 관리자 처리 메모·결정 사유는 응답에 없고 `/history`의 `reason`으로만 확인됩니다. 처리 이력의 빈 필드는 `null`이 아니라 생략됩니다(`@JsonInclude(NON_NULL)`).
- 교사 위험도 점수(1~7) → 등급 매핑 기준은 서버에 있습니다. 프론트 슬라이더의 단계 미리보기만 로컬 매핑을 쓰고, mock 서버가 같은 매핑을 흉내 냅니다.
- 교사 메시지함이 아직 mock이라, 관리자가 잠금을 해제해도 mock 스레드의 `analysis.safetyLock`은 그대로입니다. 메시지함을 `/teacher/complaints/{id}/risk`(`safetyLock`)로 연동할 때 해소됩니다.

## 미결정 정책

- HIGH 단계도 관리자 공유를 허용할지: 현재는 백엔드 정책대로 EMERGENCY만 허용합니다(`SHAREABLE_RISK_LEVEL`).

## 테스트

```bash
npx playwright test admin-escalation escalation-http-api
npx playwright test --config=playwright.admin-http.config.ts
```

- `admin-escalation`: mock 어댑터로 교사 공유 → 관리자 검토 시작·처리 완료, 긴급 하향 승인 대기(중복 요청 차단) → 결정 전 완료 불가 → 승인 후에도 잠금 유지 → 잠금 해제, 미공유 하향의 승인 대기, HIGH 공유 버튼 비활성, 권한 차단을 확인합니다.
- `escalation-http-api`: fetch를 대체해 HTTP 어댑터의 경로·본문·`current` 404 → `null`·409 메시지 노출을 확인합니다. **실제 서버 호출은 아닙니다.**
- `playwright.admin-http.config.ts`: HTTP 어댑터를 켜고 실제 관리자 화면에서 7개 API 호출, 검토 시작→완료, 새 응답 필드·이전 응답 호환성·로그 누락을 확인합니다. 데스크톱·모바일과 UTC 브라우저에서 실행하며, 백엔드 응답은 명세 기반 fixture로 대체합니다.

Mock 공유 내역 초기화:

```js
localStorage.removeItem('teacher-hub.escalations.v3');
localStorage.removeItem('teacher-hub.emergency-reviews.v1');
location.reload();
```
