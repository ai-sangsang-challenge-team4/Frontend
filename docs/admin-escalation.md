# 관리자 공유 및 처리 (#10)

교사가 긴급(EMERGENCY) 메시지를 관리자에게 공유하고, 관리자가 처리 상태를 `SHARED → UNDER_REVIEW → COMPLETED`로 변경하는 흐름입니다. 교사의 긴급 단계 하향 요청은 별도 축(`riskReviewStatus`)으로 관리자 승인·거부를 거칩니다.

상태값과 API는 백엔드 Swagger(`/v3/api-docs`) 기준입니다. 프론트에서 다른 값으로 변환하지 않습니다.

## 상태값

| 축 | 타입 | 값 |
| --- | --- | --- |
| 관리자 공유 | `EscalationStatus` | `NOT_SHARED · SHARED · UNDER_REVIEW · COMPLETED` |
| 위험도 변경 승인 | `RiskReviewStatus` | `PENDING_ADMIN_APPROVAL · APPLIED · REJECTED` |
| 민원 | `ComplaintStatus` | `DRAFT · OPEN · CLOSED` |
| 메시지 | `MessageStatus` | `DRAFT · SENT · READ` |

학부모 작성 화면의 `PARENT_REVIEW`는 서버 상태가 아닌 로컬 작성 단계(`MessageDraftStep`)입니다.

## Mock / HTTP 전환

`VITE_ESCALATION_API=http`이면 백엔드를 호출하고, 그 외(기본)는 localStorage mock(`teacher-hub.escalations.v2`)을 씁니다.

- 로그인이 아직 mock 토큰이라 http로 바꾸면 401이 납니다. 인증 연동 후 전환하세요.
- 교사 메시지함은 mock 데이터(`thread-001` 같은 문자열 ID)라, http 모드에서는 숫자 complaintId가 없는 메시지에 요청을 보내지 않고 안내 문구만 표시합니다.

## 화면

| 역할 | 경로 | 내용 |
| --- | --- | --- |
| TEACHER | `/teacher/messages/:id` → 위험 요소 탭 | 위험·긴급 메시지에 `관리자 공유` 섹션. 공유 버튼은 서버 `currentRiskLevel`이 EMERGENCY일 때만 활성. 공유 후 상태 칩, 현재 위험도, 위험도 변경 요청 상태 표시 |
| TEACHER | 같은 탭 → 위험도 검토 | 1~7점 검토를 `risk-reviews`로 저장. 저장 결과·처리 기록은 응답의 `riskLevel`·`status` 사용. 긴급 하향은 승인 대기 또는 409(관리자 공유 필요) |
| TEACHER | `/teacher/admin-share` | 내가 공유한 목록. **mock 전용** (대응 API 없음, http 모드에서는 안내 문구) |
| ADMIN | `/admin/messages` | 공유받은 목록. 상태 탭(전체·확인 대기·검토 중·처리 완료), 위험도 필터 |
| ADMIN | `/admin/messages/:escalationId` | 처리 상태(검토 시작·처리 완료·위험도 변경 승인/거부), 공유 내용, 위험 분석, 처리 기록 |

관리자 버튼 노출 조건(최종 판단은 백엔드 409):

- 검토 시작: `escalationStatus === 'SHARED'`
- 처리 완료: `escalationStatus === 'UNDER_REVIEW' && riskReviewStatus !== 'PENDING_ADMIN_APPROVAL'`
- 위험도 변경 승인/거부: `riskReviewStatus === 'PENDING_ADMIN_APPROVAL'`

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
| 위험도 변경 결정 | POST | `/admin/escalations/{escalationId}/risk-change-decision` |

409는 백엔드 `ErrorResponse.message`를 그대로 보여 줍니다.

## 백엔드 확인·추가 요청

- `AdminEscalationSummaryResponse`에 `riskReviewStatus`가 없어 관리자 화면 진입 시 승인 대기 여부를 알 수 없습니다. 지금은 관리자 액션 응답(`EscalationStateResponse`)을 받은 뒤에만 승인/거부 버튼이 보입니다. **필드 추가 필요.**
- 교사의 "내가 공유한 목록" API가 없습니다(`/teacher/admin-share`는 mock 전용). **엔드포인트 추가 필요.**
- `riskReviewStatus`, 미공유 시 `escalationId`의 nullable 여부가 스펙에 없습니다. 프론트는 `null`을 허용하도록 방어했습니다(`TODO(backend)`).
- `SHARED → COMPLETED` 직접 완료 허용 여부가 스펙에 없습니다. 처리 완료 버튼은 `UNDER_REVIEW`에서만 노출합니다.
- 관리자 목록·상세 응답에 민원 제목·학생·학급 정보가 없어 `민원 #{complaintId}`와 공유 교사(`sharedBy`)만 표시합니다.
- 관리자 처리 메모·결정 사유는 응답에 없고 `/history`의 `reason`으로만 확인됩니다.
- 교사 위험도 점수(1~7) → 등급 매핑 기준은 서버에 있습니다. 프론트 슬라이더의 단계 미리보기만 로컬 매핑을 쓰고, mock 서버가 같은 매핑을 흉내 냅니다.

## 미결정 정책

- HIGH 단계도 관리자 공유를 허용할지: 현재는 백엔드 정책대로 EMERGENCY만 허용합니다(`SHAREABLE_RISK_LEVEL`).

## 테스트

```bash
npx playwright test admin-escalation escalation-http-api
```

- `admin-escalation`: mock 어댑터로 교사 공유 → 관리자 검토 시작·처리 완료, 긴급 하향 승인 대기 → 관리자 승인, 미공유 하향 409, HIGH 공유 버튼 비활성, 권한 차단을 확인합니다.
- `escalation-http-api`: fetch를 대체해 HTTP 어댑터의 경로·본문·409 메시지 노출을 확인합니다. **실제 서버 호출은 아닙니다.**

Mock 공유 내역 초기화:

```js
localStorage.removeItem('teacher-hub.escalations.v2');
location.reload();
```
