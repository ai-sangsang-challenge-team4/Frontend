# 관리자 공유 및 처리 (#10)

교사가 긴급(EMERGENCY) 메시지를 관리자에게 공유하고, 관리자가 처리 상태를 `SHARED → UNDER_REVIEW → COMPLETED`로 변경하는 흐름입니다. 교사의 긴급 단계 하향 요청은 공유와 **독립된** Emergency 재검토 요청(`/emergency-review`)으로 지정 검토자(관리자)의 승인·거부를 거칩니다.

공개 API 계약은 배포 Swagger를 기준으로 하고, 상태 전환·권한·안전 잠금은 백엔드 `dev` 브랜치 구현도 함께 확인합니다. 프론트에서 서버 상태값을 다른 값으로 변환하지 않습니다.

## 상태값

| 축 | 타입 | 값 |
| --- | --- | --- |
| 관리자 공유 | `EscalationStatus` | `NOT_SHARED · SHARED · UNDER_REVIEW · COMPLETED` |
| Emergency 재검토 | `RiskReviewStatus` | `PENDING_ADMIN_APPROVAL · APPLIED · REJECTED` |
| 안전 잠금 | `safetyLock` | `true`면 위험도와 관계없이 교사 화면에 긴급 단계 정책 적용 |
| 민원 | `ComplaintStatus` | `DRAFT · OPEN · ANSWERED · CLOSED` |
| 메시지 | `MessageStatus` | `DRAFT · SENT · READ` |

학부모 작성 화면의 `PARENT_REVIEW`는 서버 상태가 아닌 로컬 작성 단계(`MessageDraftStep`)입니다.

## Mock / HTTP 전환

`VITE_ESCALATION_API=http`이면 백엔드를 호출하고, 그 외(기본)는 localStorage mock(`teacher-hub.escalations.v4`, `teacher-hub.emergency-reviews.v2`)을 씁니다.

- 백엔드는 JWT가 필요하므로 `VITE_AUTH_API=http`와 함께 켭니다. mock 로그인 토큰으로는 401이 납니다.
- 교사 메시지함은 mock 데이터(`thread-001` 같은 문자열 ID)라, http 모드에서는 숫자 complaintId가 없는 메시지에 요청을 보내지 않고 안내 문구만 표시합니다.

## 화면

| 역할 | 경로 | 내용 |
| --- | --- | --- |
| TEACHER | `/teacher/messages/:id` → 위험 요소 탭 | 위험·긴급 메시지에 `관리자 공유` 섹션. 공유 버튼은 서버 `currentRiskLevel`이 EMERGENCY일 때만 활성. 공유 후 상태 칩, 현재 위험도, 위험도 변경 요청 상태 표시 |
| TEACHER | 같은 탭 → 위험도 검토 | 일반 위험도 검토는 `risk-reviews`로 저장하고, 긴급 하향은 `emergency-review`로 요청합니다. 현재 EMERGENCY에서 점수를 바꾸면 공유 여부와 관계없이 Emergency 재검토 요청이 생기고 요청 응답은 `status: PENDING_ADMIN_APPROVAL`·`safetyLock: true`·`requestId`를 포함합니다(`risk-reviews`를 경유하는 경우에는 `emergencyReviewRequestId`). 승인 대기 중에는 중복 요청을 막습니다. 반려 후에는 안전 잠금이 유지되어도 다시 요청할 수 있습니다. 최근 요청 상세는 `emergency-review/current`로 조회합니다. |
| TEACHER | 같은 탭 → 관리자 공유 섹션 | 공유 상태, 현재 위험도, 재검토 요청 상태, 안전 잠금 표시. 서버 `safetyLock`이 true면 답변 작성 잠금 유지 |
| TEACHER | `/teacher/admin-share` | 내가 공유한 목록. HTTP 목록 조회·상태/위험도 필터·검색·페이지 이동 지원 |
| ADMIN | `/admin/emergency-reviews` 및 `/:requestId` | 나에게 지정된 긴급 재검토 목록·상세, 승인·거부·안전 잠금 해제. 공유 여부와 독립 |
| ADMIN | `/admin/messages` | 공유받은 목록. 상태 탭(전체·확인 대기·검토 중·처리 완료), 위험도 필터 |
| ADMIN | `/admin/messages/:escalationId` | 처리 상태(검토 시작·처리 완료), Emergency 재검토 요청 내용(이전→요청 위험도, 사유)과 승인/거부, 안전 잠금 해제, 공유 내용, 위험 분석, 처리 기록 |

관리자 버튼 노출 조건(최종 판단은 백엔드 409):

- 검토 시작: `escalationStatus === 'SHARED'`
- 처리 완료: `escalationStatus === 'UNDER_REVIEW' && riskReviewStatus !== 'PENDING_ADMIN_APPROVAL'` (승인 대기면 서버 409 `ESCALATION_STATE_INVALID`)
- 위험도 변경 승인/거부: `emergencyReviewRequestId !== null && riskReviewStatus === 'PENDING_ADMIN_APPROVAL'` → `PATCH /admin/emergency-review/{requestId}` `{ status, message }`. 공유 상태와 무관
- 긴급 하향 승인: `PATCH … { status: APPLIED, message }`가 요청 위험도와 안전 잠금 해제를 함께 반영합니다. 응답·재조회한 `safetyLock`을 사용하고 프론트가 승인 상태만으로 잠금을 해제하지 않습니다. 승인된 이전 기록에서 `safetyLock === true`가 명시된 경우에만 `PATCH … { safetyLock: false }`를 제공하며 승인 전·반려 상태에서는 제공하지 않습니다.

처리 메모(검토 시작·처리 완료)는 필수입니다(백엔드 `@NotBlank`). 재검토 결정 사유는 백엔드에서 선택이지만 기록을 남기도록 UI에서 필수로 받습니다.

교사 위험도 검토는 현재 교사 검토 기준 점수에서 상향·하향하는 경우 모두 검토 사유(최대 300자)가 필수입니다. 같은 점수를 유지하는 검토는 사유 없이 저장할 수 있습니다. 긴급 단계의 하향은 `재검토 요청` 하나로 지정 검토자에게 전송하며, 실제 접수 후 `검토자 확인 대기`를 표시합니다. 하향 승인 시 서버가 잠금도 함께 해제합니다. 교사가 요청한 것만으로 잠금을 해제하지 않습니다.

### 공유 시 선택 자료

위험 요소 탭에서 `관리자에게 공유`를 누른 뒤 공유 사유와 자료를 선택합니다. 별도의 증빙 생성 카드는 표시하지 않습니다. 개인정보가 가려진 메시지는 기본으로 포함하며, 원문과 증빙은 교사가 선택한 경우에만 해당 scope를 전송합니다. 증빙 없이도 공유할 수 있습니다.

공유 창의 `증빙 패키지 생성 후 첨부`는 기존 생성 권한·위험도 조건을 확인하고, 준비가 성공한 경우에만 첨부 대상으로 선택합니다. 선택을 해제하면 생성 여부와 관계없이 `MEDIATION_PACKAGE`를 보내지 않습니다. 창을 취소해도 준비한 증빙의 로컬 상태는 남지만, 공유 요청은 전송되지 않으며 다시 열면 자료 선택과 사유는 초기화됩니다.

증빙 준비는 기존과 동일한 브라우저 메모리·로컬 이력 동작입니다. 서버 파일 생성·보관 API는 아직 연결되지 않았습니다. `MEDIATION_PACKAGE`는 기존 공유 API의 선택 scope를 사용합니다.

### 관리자 상세 응답 표시

- 공유 메시지의 `status`(작성 중·전송됨·읽음), `readAt`(읽은 시각)을 표시합니다. 이전 서버에서 필드가 생략되면 표시하지 않습니다.
- 위험 요소는 `state`의 탐지·미탐지·경계·미확인 상태와 `evidenceSpans[].text`의 근거 구간을 표시합니다. 이전 서버의 단일 `evidence`도 지원하며, 명시적으로 빈 `evidenceSpans`가 오면 이전 근거로 대체하지 않습니다. 같은 응답을 사용하는 교사 화면에도 상태와 모든 근거 구간을 반영합니다. 원문 열람 권한이 있을 때 각 근거 구간을 표시하고, 선택한 구간과 정확히 일치하는 원문으로 이동합니다.
- 처리 이력의 `logComplete: false` 또는 비어 있지 않은 `missingLogs`가 있으면 누락 안내와 해당 항목을 표시합니다. 이력이 비어 있어도 누락 안내를 유지하며, 이벤트의 민원 상태 변경과 `referenceType`·`referenceId`에 따른 관련 항목을 함께 표시합니다.
- 시간대가 없는 서버 시각은 KST로 해석합니다.

## API

| 기능 | Method | Endpoint |
| --- | --- | --- |
| 공유 상태 조회(교사) | GET | `/teacher/complaints/{complaintId}/escalation` |
| 공유 목록(교사) | GET | `/teacher/escalations?page=&keyword=&status=&riskLevel=` |
| 공유 건 조회(교사) | GET | `/teacher/escalations/{escalationId}` |
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

- `/teacher/admin-share`는 `GET /teacher/escalations`로 본인이 공유한 내역을 조회합니다. 서버의 10건 단위 페이지·제목/학생명 검색·위험도/처리 상태 필터를 사용하고, 탭 건수는 각 상태 조회의 `totalElements`를 표시합니다. 목록의 메시지를 선택하면 기존 교사 메시지 상세로 이동합니다. HTTP·mock 어댑터는 같은 페이지 응답을 반환합니다.
- 미공유 상태 응답은 `escalationId`가 `null`이고, 재검토 요청이 없으면 `emergencyReviewRequestId`·`riskReviewStatus`도 `null`입니다. 완료된 분석이 없으면 `currentRiskScore`·`currentRiskLevel`도 `null`입니다(백엔드 dev 코드로 확인).
- `SHARED → COMPLETED` 직접 완료는 불가합니다(백엔드 코드로 확인). 재검토 결정은 공유 상태와 무관합니다.
- `/admin/emergency-reviews`에서 지정 검토자의 전체 재검토 요청을 조회합니다. 공유되지 않은 민원도 `/admin/emergency-reviews/:requestId`에서 요청 상세 확인과 승인·거부가 가능합니다. 하향 승인 시 잠금도 함께 해제됩니다.
- 관리자 목록·상세 응답에 민원 제목·학생·학급 정보가 없어 `민원 #{complaintId}`와 공유 교사(`sharedBy`)만 표시합니다.
- 관리자 처리 메모·결정 사유는 응답에 없고 `/history`의 `reason`으로만 확인됩니다. 처리 이력의 빈 필드는 `null`이 아니라 생략됩니다(`@JsonInclude(NON_NULL)`).
- 시스템 위험 점수는 0~100점으로 표시하고, 교사 검토는 별도의 1~7단계(`reviewScale`)로 표시합니다(#77). 교사가 고른 값은 서버가 10을 곱해 `reviewScore`(10~70)로 저장합니다. 현재 적용 등급은 `currentRiskLevel`을 따르고 시스템 점수를 교사 7점 척도로 환산하지 않습니다. 이력·공유 요약의 점수는 서버 값을 그대로 표시합니다. 등급 판정은 서버가 하며, 프론트 슬라이더 미리보기와 mock 서버만 교사 척도의 기준을 흉내 냅니다.
- 위험 분석의 `analysisMode=RULE_ONLY` 또는 `aiAnalysisStatus`의 잠정 분석 상태와 `manualReviewRequired`에 따라 잠정 분석·직접 검토 안내를 표시합니다. 설명 문자열로 상태를 추측하지 않으며 새 필드가 생략된 이전 응답도 지원합니다.
- 관리자 위험 분석 탭은 시스템 분석(`riskScore`, 0~100), 교사 검토(`reviewScale`, 1~7단계, 검토가 없으면 숨김), 현재 적용 등급(`currentRiskLevel`)을 나눠 보여 줍니다. `reviewScale`이 없으면 `reviewScore`를 시스템 점수처럼 표시하지 않고 척도 정보 없음으로 안내합니다.
- 긴급 재검토 목록·상세와 공유 상세의 처리 패널(`AdminProcessPanel`)은 기존 점수(`previousRiskScore`)를 그대로 표시하고, 요청값은 `requestedRiskScale/7단계`로 표시합니다. `requestedRiskScore`를 100점 시스템 점수나 같은 척도의 비교값으로 보여 주지 않습니다.
- 교사 메시지함이 아직 mock이라, 관리자가 잠금을 해제해도 mock 스레드의 `analysis.safetyLock`은 그대로입니다. 메시지함을 `/teacher/complaints/{id}/risk`(`safetyLock`)로 연동할 때 해소됩니다.

## 미결정 정책

- HIGH 단계도 관리자 공유를 허용할지: 현재는 백엔드 정책대로 EMERGENCY만 허용합니다(`SHAREABLE_RISK_LEVEL`).

## 테스트

```bash
npx playwright test admin-escalation escalation-http-api
npx playwright test --config=playwright.admin-http.config.ts
```

- `admin-escalation`: mock 어댑터로 교사 공유 → 관리자 검토 시작·처리 완료, 긴급 하향 승인 대기(중복 요청 차단) → 결정 전 완료 불가 → 승인 시 위험도와 잠금 해제 반영, 미공유 하향의 승인 대기, HIGH 공유 버튼 비활성, 권한 차단을 확인합니다.
- `escalation-http-api`: fetch를 대체해 HTTP 어댑터의 경로·본문·`current` 404 → `null`·409 메시지 노출을 확인합니다. 교사 공유 목록의 페이지·검색·상태·위험도 쿼리, 인증 헤더와 공유 건 조회의 접근 거부도 검증합니다. **실제 서버 호출은 아닙니다.**
- `playwright.admin-http.config.ts`: HTTP 어댑터를 켜고 실제 관리자 화면에서 7개 API 호출, 검토 시작→완료, 새 응답 필드·이전 응답 호환성·로그 누락을 확인합니다. #77의 잠정 분석·직접 검토 안내와 시스템 95/100·교사 5/7단계·현재 적용 등급 구분도 확인합니다. 데스크톱·모바일과 UTC 브라우저에서 실행하며, 백엔드 응답은 명세 기반 fixture로 대체합니다. 실제 배포 AI 연결 테스트는 아닙니다.
- `teacher-escalations-http.spec.ts`는 공유 API만 HTTP로 설정한 테스트 전용 구성에서 교사 공유 내역의 전체 건수·페이지 이동·상태 전환·위험도/학생명 검색·검색 결과 없음·실패 재시도·늦은 응답 차단을 검증합니다. 링크의 접근성 이름, 마지막 유효 페이지 복귀, 모바일 가로 넘침도 확인합니다.

Mock 공유 내역 초기화:

```js
localStorage.removeItem('teacher-hub.escalations.v4');
localStorage.removeItem('teacher-hub.emergency-reviews.v2');
location.reload();
```

`npx playwright test --config=playwright.integration-http.config.ts`는 명세 fixture로 정책 동의·미공유 재검토·교사 반려 후 재요청을 검증합니다. 메시지와 공유 API가 모두 HTTP인 이 구성에서 교사 공유 링크를 클릭해 민원 상세와 대화가 표시되는지도 확인합니다.
