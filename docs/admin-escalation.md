# 관리자 공유 및 처리 (#10)

교사가 위험·긴급 메시지를 관리자에게 직접 공유하고, 관리자가 처리 상태를 `SHARED → UNDER_REVIEW → COMPLETED`로 변경하는 흐름입니다. 현재는 Mock API(`teacher-hub.escalations` localStorage)로 동작하며, 같은 브라우저에서 교사·관리자 계정을 바꿔 로그인하면 공유 내역이 이어집니다.

## 화면

| 역할 | 경로 | 내용 |
| --- | --- | --- |
| TEACHER | `/teacher/messages/:id` → 위험 요소 탭 | 위험(High)·긴급(Emergency) 메시지에 `관리자 공유` 섹션 표시. 공유 사유(필수, 500자) 입력 모달, 원문·증빙 패키지 첨부 선택, 공유 후 상태 칩과 사유·관리자 메모 표시, 처리 기록에 `관리자 공유` 로그 추가 |
| TEACHER | `/teacher/admin-share` | 내가 공유한 메시지 목록과 관리자 처리 상태 |
| ADMIN | `/admin/messages` | 공유받은 메시지 목록. 처리 상태 탭(전체·확인 대기·검토 중·처리 완료), 위험도 필터 |
| ADMIN | `/admin/messages/:id` | 처리 상태 변경(검토 시작·처리 완료, 메모 선택 입력), 공유 내용(교사 사유·공유된 메시지), 위험 분석(완충 요약·위험 요소·권장 처리), 처리 기록 |

## 권한

- 관리자 목록·상세는 교사가 공유한 메시지 중 본인에게 배정된 건만 조회됩니다.
- 공유되지 않은 메시지 상세(`/admin/messages/{id}`)는 403 `COMPLAINT_NOT_SHARED`로 막고 오류 화면을 표시합니다.
- 원문은 교사가 `원문 메시지`를 선택한 경우에만 관리자에게 전달됩니다. 기본은 개인정보가 가려진 메시지입니다.
- TEACHER가 `/admin/*`에 접근하면 `RoleRoute`가 교사 홈으로 보냅니다.

## API

`src/features/escalation/api/escalationApi.ts`의 `api`를 `httpEscalationApi`로 바꾸면 실제 서버를 호출합니다.

| 기능 | Method | Endpoint | 명세 |
| --- | --- | --- | --- |
| 관리자 공유 | POST | `/complaints/{complaintId}/escalations` | 명세 있음 |
| 관리자 처리함 | GET | `/admin/complaints` | 명세 있음 (`reason`, `title` 응답 필드 추가 필요) |
| 관리자 검토·처리 | PATCH | `/admin/complaints/{complaintId}` | 명세 있음 (`START_REVIEW` action 추가 필요) |
| 공유 대상 관리자 목록 | GET | `/admins` | **가정** |
| 민원별 공유 상태(교사) | GET | `/complaints/{complaintId}/escalations` | **가정**, 미공유 시 404 |
| 내가 공유한 목록(교사) | GET | `/escalations?scope=mine` | **가정** |
| 공유 메시지 상세(관리자) | GET | `/admin/complaints/{complaintId}` | **가정**, 미공유·타 관리자 배정 시 403 |

## 백엔드 확인 필요

- `PATCH /admin/complaints/{id}`의 action 값: 명세에는 `REVIEW_COMPLETE`만 있어 검토 시작은 `START_REVIEW`로 가정했습니다. 반려·교사 반환(`RETURNED_TO_TEACHER`) action은 이번 범위에서 제외했습니다.
- 위의 **가정** 엔드포인트 4개의 경로와 응답 형식
- 오류 코드: `ALREADY_ESCALATED`(409), `COMPLAINT_NOT_SHARED`(403), `ESCALATION_NOT_FOUND`(404), `INVALID_ESCALATION_TRANSITION`(409) 등은 프론트 Mock 기준 이름입니다(`src/shared/api/apiError.ts`).
- 공유 가능 위험도: 위험·긴급만 공유 버튼을 노출합니다. 주의(Medium) 포함 여부는 정책 확정이 필요합니다.
- `evidencePackageId`: Mock 메시지함에 패키지 ID가 없어 첨부 여부만 전달합니다.

## 테스트

```bash
npx playwright test admin-escalation
```

교사 공유 → 관리자 검토 시작·처리 완료 → 교사 화면 상태 반영, 일반 위험도 메시지의 버튼 미노출, 미공유 메시지 403, 교사의 관리자 화면 접근 차단을 확인합니다.

Mock 공유 내역 초기화:

```js
localStorage.removeItem('teacher-hub.escalations');
location.reload();
```
