# 학부모 문의 작성·분석·제출 API 연동 (#55)

`VITE_MESSAGE_API=http`이면 학부모 **새 문의**를 백엔드 흐름(서버 DRAFT → AI 분석 → 수정안 → 수정 → 제출)으로 처리합니다. mock 모드(기본)는 기존 로컬 흐름(mock 분석, 브라우저 저장)을 그대로 씁니다. 교사 쪽 설정과 같은 값을 공유하므로 `VITE_AUTH_API=http`와 함께 켭니다.

## API

| 단계 | Method | Endpoint | 비고 |
| --- | --- | --- | --- |
| 자녀 목록(임시) | GET | `/complaints?page=` | 자녀 API가 없어 본인 민원 목록의 `studentId`·`studentName`을 모든 페이지에서 중복 없이 모음 |
| 수신 교사 | GET | `/complaints/recipients?studentId=` | 학생의 최신 학급 담당 교사. 담임이 먼저 오고 "(담임)"을 붙여 표시, 첫 교사를 기본 선택 |
| 서버 초안 | POST | `/complaints` | `{ studentId, teacherId, title, content }`. "AI 분석 시작"을 처음 누를 때 생성 |
| 본문 수정 | PATCH | `/complaints/{id}` | `{ content }`. 분석 전 본문을 바꿨거나, 검토 화면에서 고른 문장이 서버 내용과 다를 때 |
| 분석 | POST | `/complaints/{id}/risk-analysis` | 점수·등급만 반환. 같은 내용이면 기존 분석을 다시 돌려줌 |
| 근거·수정안 | GET | `/risk-analyses/{analysisId}/findings` | 태그별 근거와 수정 제안, 최종 수정안(AI 초안 탭) |
| 제출 | POST | `/complaints/{id}/send` | 분석 뒤 내용이 바뀌었으면 서버가 최종 내용을 한 번 더 분석하고 제출 |
| 상태 | GET | `/complaints/{id}/status` | 제출 응답을 놓친 재시도에서 `COMPLAINT_NOT_DRAFT`가 오면 이미 제출됐는지 확인 |

`GET /risk-analyses/{analysisId}`(요약 조회)는 API 명세에만 있고 서버에는 없어 쓰지 않습니다.

## 흐름

1. **작성**: 자녀 → 문의 대상 → 제목·내용. 임시저장은 지금처럼 브라우저에만 저장합니다(서버 초안은 분석을 시작할 때 생김).
2. **AI 분석 시작**: 서버 초안이 없으면 `POST /complaints`, 있으면 본문이 바뀐 경우에만 `PATCH` → 분석 → findings. 단계마다 서버 초안 ID를 로컬 초안에 저장해, 중간에 실패해도 다시 시도할 때 같은 서버 초안을 씁니다. 분석 중 "문의 작성으로 돌아가기"를 눌러도 초안 생성 요청은 끊지 않고 끝까지 받아 연결합니다(삭제 API가 없어 끊으면 연결 없는 초안이 서버에 남음). 생성이 끝나기 전에 다시 분석하면 같은 생성 요청을 기다립니다.
3. **잠금**: 서버 초안이 생기면(생성 요청이 진행 중일 때도) 자녀·문의 대상·제목은 바꿀 수 없습니다. `PATCH`가 본문만 받기 때문이며, 화면에 안내 문구를 표시합니다.
4. **검토**: findings를 기존 검토 화면 모델로 바꿉니다. 서버 태그 8종은 이름(`/risk-tags` 기준)과 아이콘을 붙이고, 근거 줄마다 항목 하나를 만들고 수정 제안이 있으면 "수정 제안: …"을 표시합니다. `LEGAL`이 있으면 기존 "공식 절차 의사 완화" 경고를 띄웁니다. 최종 수정안이 분석한 본문과 같거나 없으면 AI 초안 탭은 비활성입니다.
5. **전송**: 선택한 문장(AI 초안·원문·직접 수정)이 서버 내용과 다르면 `PATCH` 후 `send`합니다. 이때 확인 창에 "전송할 때 한 번 더 분석합니다" 안내가 나옵니다. 전송 뒤에는 접수 화면과 문의 내역이 아직 브라우저 저장소를 읽으므로 로컬 사본(`serverComplaintId` 포함)을 남깁니다.

### 분석 정책

- AI 검토는 메시지당 1회입니다. 분석 후 작성 화면으로 돌아가 본문을 고치고 다시 "AI 분석 시작"을 누르면 서버가 409 `FINAL_ANALYSIS_ON_SUBMIT`를 줍니다. 이때 검토 화면으로 넘어가되 새 수정안 없이 "전송할 때 수정한 내용을 한 번 더 분석합니다"를 안내합니다(`REANALYSIS_LIMIT_REACHED`도 같음).
- findings 조회만 실패하면 분석은 저장돼 있어 전송할 수 있습니다. 검토 화면은 기존 "AI 수정안을 불러오지 못했습니다" 상태로 열립니다.
- 그 밖의 분석 실패(네트워크·500 등)는 서버 분석이 없어 제출이 거부되므로, 검토 화면으로 넘어가지 않고 작성 화면에서 다시 시도하게 합니다. mock 모드는 기존처럼 실패 상태로 검토 화면을 엽니다.

## 개인정보 마스킹

프론트 마스킹을 유지합니다. 서버로 보내는 제목·본문(`POST`·`PATCH`)은 전화번호·이메일·주민등록번호를 가린 문장입니다. 서버는 받은 원문을 그대로 저장하고 LLM에 보낼 때만 따로 가린 사본을 쓰며, 교사 대화 조회(위험도 LOW)는 저장된 원문을 보여 주기 때문입니다.

## 오류 처리

| 코드 | 화면 |
| --- | --- |
| `INVALID_COMPLAINT_RECIPIENT` (400) | 문의 대상 필드 오류로 표시하고 교사 목록을 다시 불러옴 |
| `INVALID_REQUEST` (400, 초안 생성) | 학부모와 학생이 연결되지 않았을 때 서버가 주는 범용 코드라, 초안 생성에서만 자녀 필드에 "자녀와 계정의 연결을 확인하지 못했어요"로 안내 |
| `FINAL_ANALYSIS_ON_SUBMIT`, `REANALYSIS_LIMIT_REACHED` (409, 분석) | 새 수정안 없이 검토 화면, 제출 시 재분석 안내 |
| `COMPLAINT_NOT_DRAFT` (409, 제출) | `/status`가 DRAFT가 아니면 이미 제출된 것으로 보고 접수 화면으로 이동. DRAFT면 오류 문구 |
| `ANALYSIS_REQUIRED` (409, 제출) | "AI 분석과 수정안 확인을 마친 후 제출해 주세요." |
| `COMPLAINT_NOT_FOUND` (404, 분석) | 저장된 서버 초안 연결을 지워, 다시 시도하면 새 서버 초안을 만듦 |
| 그 외 | `getApiErrorMessage` 문구. 작성한 내용은 유지 |

## 아직 연동하지 않은 것

- **자녀 목록 API**: 임시로 민원 목록에서 자녀를 모읍니다. 민원이 하나도 없는 학부모는 자녀를 고를 수 없어 "확인된 자녀 정보가 없습니다"가 나옵니다. API가 생기면 `serverComplaint.ts`의 `listServerChildren`만 바꾸면 됩니다.
- **추가 문의**(`/message-draft`, `/messages/{messageId}/risk-analysis`·`send`): 서버로 제출한 문의의 "추가 문의하기"는 "아직 준비 중"으로 막습니다. 로컬 문의의 추가 문의는 기존 로컬 흐름입니다.
- **학부모 문의 내역·상세·대화 조회**(`GET /complaints`, `/{id}`, `/messages`, `/close`): 화면은 아직 브라우저 사본을 읽으므로, 서버로 낸 문의에 교사가 답해도 학부모 화면에는 반영되지 않습니다.

## 코드

- `api/`: `parentComplaintTypes.ts`(DTO), `parentComplaintApiContract.ts`, `httpParentComplaintApi.ts`, `parentComplaintApi.ts`(모드). mock 모드는 DTO 수준 mock 대신 기존 `parentMessageApi.ts` 로컬 흐름을 씁니다(교사 메시지함과 같은 방식).
- `serverComplaint.ts`: 자녀 목록(`listServerChildren`), 교사 선택지, findings → 검토 모델(`toServerAnalysis`), 초안·분석(`analyzeServerDraft`), 제출(`submitServerDraft`).
- `useServerRecipients.ts`: 작성 화면의 자녀·교사 목록.
- `messageDraft.ts`: 로컬 초안의 `studentId`, `server`(서버 초안 ID·고정 필드·서버에 저장된 본문·분석 ID).

## 테스트

```bash
npx playwright test parent-message-api
```

fetch를 대체해 요청 경로·메서드·본문, 마스킹한 본문 전송, PATCH 조건, 409 처리, 재시도 시 이미 제출된 민원 처리, findings 매핑을 확인합니다. 실제 서버 호출은 아닙니다. 기존 mock 화면 흐름은 `parent-message-write`·`parent-message-review` 테스트가 그대로 확인합니다. `.env.local`이 http 모드면 화면 테스트가 실패하므로 환경 변수를 덮어 실행합니다.

```bash
VITE_AUTH_API=mock VITE_MESSAGE_API=mock VITE_ESCALATION_API=mock VITE_API_PROXY_TARGET= npm run test:auth
```

### 배포 서버 수동 확인 (2026-10-29)

로컬 개발 서버(http 모드, 프록시 `https://teacherhub.duckdns.org`), `parent@test.com`으로 확인했습니다. 테스트 민원은 complaintId 3 "[테스트] #55 학부모 문의 연동 확인"입니다.

| 확인 | 결과 |
| --- | --- |
| 자녀·교사 자동 선택 | 민원 목록에서 Demo Student, recipients에서 "Demo Teacher 선생님 (담임)" |
| AI 분석 시작 | `POST /complaints` 201 → `risk-analysis` 200 → `findings` 200, 검토 화면 이동 |
| 검토 화면 | 서버 Mock 근거(욕설·위험·협박·부당 요구)와 Mock 최종 수정안 표시 |
| AI 초안으로 전송 | 재분석 안내 표시, `PATCH` 200 → `send` 200 → 접수 화면 |
| 서버 반영 | 상태 `OPEN`·`waitingFor=TEACHER`, 교사 상세 조회 가능, 이력에 `RISK_ANALYZED` 2건(최초·제출 시) |

서버 탐지기·수정안 생성기가 Mock이라 근거가 본문과 관계없는 "[MOCK RULE] …" 문장이고 원문에 강조되지 않으며, 등급은 항상 HIGH입니다.
