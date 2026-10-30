# 교사 메시지함 조회 API 연동 (#53)

`VITE_MESSAGE_API=http`이면 교사 메시지함(목록·상세·대화·위험 요소·처리 기록·원문 열람)을 백엔드 `/teacher/complaints` API로 읽습니다. 그 외(기본)는 기존 로컬 메시지함(mock 스레드 + 학부모 메시지 브리지)을 그대로 씁니다. 로컬 메시지함은 서버 DTO가 없어 DTO 형태의 mock 어댑터는 두지 않았습니다.

백엔드는 JWT가 필요하므로 `VITE_AUTH_API=http`와 함께 켭니다. 위험도 검토·관리자 공유·Emergency 재검토까지 실서버로 쓰려면 `VITE_ESCALATION_API=http`도 켭니다. 서버 스레드의 id는 숫자 complaintId라 escalation API가 그대로 동작합니다.

## API

| 화면 | Method | Endpoint | 비고 |
| --- | --- | --- | --- |
| 목록 | GET | `/teacher/complaints?page=&keyword=&status=&riskLevel=&sort=` | 페이지 크기 10 고정, "메시지 더 보기"로 다음 페이지 |
| 상세 | GET | `/teacher/complaints/{id}` | |
| 대화 | GET | `/teacher/complaints/{id}/messages` | LOW 초과 학부모 메시지는 메시지마다 완충 요약(`summarized: true`) 카드로 표시 |
| 위험 요소 | GET | `/teacher/complaints/{id}/risk` | 404(분석 없음)는 "분석 실패"로 표시 |
| 처리 기록 | GET | `/teacher/complaints/{id}/history` | 최신순 응답을 오래된 순으로 표시 |
| 원문 열람 | POST | `/teacher/complaints/{id}/messages/{messageId}/original-views` | 메시지 하나의 원문 반환 + 서버가 `ORIGINAL_VIEWED` 기록. 받은 뒤 원문 화면을 엶. 요약 카드마다 그 메시지의 원문을 열고, 위험 요소·답변 작성 화면의 원문 보기는 최신 학부모 메시지(최신 분석 대상)를 엶. `messageId`는 대화의 `message:{id}`에서 숫자만 사용 |
| 상담 완료 | POST | `/teacher/complaints/{id}/close` | `OPEN`·`waitingFor=PARENT`(답변 뒤 학부모 차례)만 요청. 교사 차례면 "답변을 보낸 뒤에 상담을 완료할 수 있습니다" 안내. 완료 뒤 상세를 다시 불러와 상담 완료로 표시 |
| 사이드바 숫자 | GET | `/teacher/complaints?status=OPEN` | `totalElements` |

메시지를 열면 상세·대화·위험·이력을 함께 불러옵니다. 위험도 검토·관리자 공유·원문 열람·상담 완료 뒤에는 서버 상태(위험도·안전 잠금·이력)를 다시 불러옵니다.

- 같은 메시지의 상세 요청이 겹치면 마지막 요청의 응답만 반영합니다.
- 상세 조회가 실패하면 위험 요소 탭에 "다시 불러오기"를 표시합니다. 처리 기록만 실패하면 마지막으로 불러온 기록을 유지하고 실패 안내와 "다시 시도"를 표시합니다.
- 목록 첫 페이지가 실패하면 이전 필터 결과를 비우고 오류 화면을, "더 보기"가 실패하면 그 페이지만 다시 요청합니다.
- 목록을 다시 불러오면 열어 둔 메시지도 제목·상태·위험도 같은 서버 필드는 갱신하고 별표·답변 초안은 유지합니다.

## 필터 매핑

| 화면 | 서버 쿼리 |
| --- | --- |
| 진행 중 상담 / 완료된 상담 / 전체 | `status=OPEN` / `CLOSED` / 없음 |
| 위험도 | `riskLevel` (최신 교사 검토가 있으면 그 등급 기준) |
| 검색 | `keyword` (제목·학생명·학부모명·메시지 내용, 300ms 디바운스, 최대 100자: 서버 `@Size(max = 100)`) |
| 정렬 | 최신순 `LATEST` / 오래된순 `OLDEST`. 위험도순·상담 상태순은 서버에 없어 서버 모드에서는 표시하지 않음 |

## 응답 → 화면 모델(`BoardThread`)

- 상담 상태: `CLOSED`·`waitingFor=NONE` → 상담 완료, `waitingFor=PARENT` 또는 교사 답변이 있으면 → 상담 중, 그 외 → 상담 전. 교사 답변 뒤 `waitingFor=TEACHER`(추가 문의)면 "재확인 필요".
- 위험 분류: 백엔드 `RiskTagCode` 8종과 화면 분류 8종이 1:1입니다(PROFANITY→감정적 표현, INSULT→인신공격, THREAT→위협, LEGAL→법적·행정적 조치, EXPOSURE→공개·유포 위협, REPEAT→반복성, UNFAIR_REQUEST→무리한 요구, PRIVACY→개인정보 위험). `detectedFactors`에 있으면 탐지, 없으면 미탐지입니다.
- 위험 점수(2026-10-30 백엔드 정책): 시스템 점수 `riskScore`는 탐지된 태그 점수의 합(0~70, LOW ≤20·MEDIUM ≤40·HIGH ≤60·EMERGENCY)입니다. 교사는 1~7점(`reviewScale`)을 고르고 서버가 10을 곱해 `reviewScore`(10~70)로 저장합니다. 현재 적용 위험도는 `currentRiskScore`·`currentRiskLevel`입니다. 처리 기록의 `RISK_REVIEWED` 점수도 10배 값입니다. 화면에는 모두 7점 기준으로 바꿔 표시합니다(예: 시스템 23점 → 3점, 교사 선택 4 → 4점).
- 교사 검토 위험도: 검토가 없으면 `reviewScale`·`reviewScore`·`reviewLevel`이 `null`입니다. 화면의 1~7점 슬라이더에는 `reviewScale`을 씁니다.
- 증빙 패키지 가능 여부: `allowedActions`에 `CREATE_EVIDENCE_PACKAGE`가 있을 때.
- 위험도 검토 가능: `status=OPEN`이고 `waitingFor=TEACHER`일 때(백엔드 규칙과 동일).
- 날짜: 서버 `LocalDateTime`은 타임존이 없고 서버 시각이 KST라 `+09:00`을 붙여 해석합니다(`shared/api/serverDateTime.ts`).
- 목록 미리보기·대화 요약은 서버 `aiSummary`를 씁니다. 백엔드 요약기는 아직 Mock이라 `[MOCK]` 문구가 보입니다.

## 서버 모드에서 로컬 전용인 것

백엔드에 대응 데이터가 없어 브라우저 메모리에만 남고 새로고침하면 사라집니다.

- 별표(고정), AI 판단 이의 제기, 증빙 패키지 생성, 학생 안전 신호(항상 "없음"), 지정 담당자 재검토 요청
- 탭별 답변 초안 상태와 공식 템플릿 입력값(서버에는 현재 탭 내용 하나만 임시저장)

AI 초안·임시저장·답변 전송은 [teacher-reply-api.md](teacher-reply-api.md)(#54)에서 서버에 연결했습니다.

## 백엔드 확인·요청

- `allowedActions`는 백엔드가 위험 등급(잠금 중이면 EMERGENCY)으로 계산합니다. 화면 정책(낮음·주의 AI 초안, 위험 공식 템플릿, 긴급 답변 차단)과 대체로 같지만 `USE_RESPONSE_TEMPLATE`는 LOW·MEDIUM에도 포함됩니다. 지금은 증빙 패키지 가능 여부에만 사용합니다.
- 목록 응답에 최신 메시지 내용이 없어 미리보기에 `aiSummary`를 씁니다.
- `GET /users/me` 500 버그는 2026-10-30 배포 서버에서 고쳐진 것을 확인했습니다(200, `students` 포함). 5xx일 때 저장된 사용자를 유지하는 임시 우회([auth-mock-testing.md](auth-mock-testing.md))는 남아 있어 정리할 수 있습니다.
- `POST /close`가 불가능한 상태면 409 `RESPONSE_NOT_EDITABLE`과 구체적인 이유(예: "이미 완료된 민원은 다시 완료 처리할 수 없습니다.")를 줍니다. `RESPONSE_NOT_EDITABLE`은 서버 문구를 우선 표시합니다.

## 테스트

```bash
npx playwright test teacher-inbox-api
```

`teacher-inbox-api.spec.ts`는 fetch를 대체해 요청 경로·쿼리와 응답 변환(상태·위험 분류·교사 검토·완충 요약·이력 순서·생략 필드·KST 시각)을 확인합니다. 실제 서버 호출은 아닙니다. 화면 연결은 배포 서버(dev 계정)로 수동 확인했습니다: 로그인 → 목록 → 완료 필터·검색 → 상세·대화 → 위험 요소(위협 탐지·잠금·관리자 공유) → 원문 열람 → 처리 기록.
