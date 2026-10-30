# 학부모 문의 작성·분석·제출 API 연동 (#55)

`VITE_MESSAGE_API=http`이면 학부모 **새 문의와 서버 문의의 추가 문의**를 백엔드 흐름(서버 DRAFT → AI 분석 → 수정안 → 수정 → 제출)으로 처리합니다. mock 모드(기본)는 기존 로컬 흐름(mock 분석, 브라우저 저장)을 그대로 씁니다. 교사 쪽 설정과 같은 값을 공유하므로 `VITE_AUTH_API=http`와 함께 켭니다. HTTP 모드에서 서버 ID가 없는 로컬 문의는 새 문의 작성으로 안내합니다.

## API

| 단계 | Method | Endpoint | 비고 |
| --- | --- | --- | --- |
| 자녀 목록 | GET | `/users/me` | 응답의 `students`(연결된 자녀). 연결된 자녀가 없으면 고를 자녀가 없음 |
| 수신 교사 | GET | `/complaints/recipients?studentId=` | 학생의 최신 학급 담당 교사. 담임이 먼저 오고 "(담임)"을 붙여 표시, 첫 교사를 기본 선택 |
| 서버 초안 | POST | `/complaints` | `{ studentId, teacherId, title, content }`. "AI 분석 시작"을 처음 누를 때 생성 |
| 본문 수정 | PATCH | `/complaints/{id}` | `{ content }`. 분석 전 본문을 바꿨거나, 검토 화면에서 고른 문장이 서버 내용과 다를 때 |
| 서버 마스킹 | POST | `/complaints/{id}/mask` | 최초 민원 초안의 분석 전 호출. `maskedContent`와 `contentVersion`을 검토 결과에 반영 |
| 분석 | POST | `/complaints/{id}/risk-analysis` | 점수·등급만 반환. 같은 내용이면 기존 분석을 다시 돌려줌 |
| 근거·수정안 | GET | `/risk-analyses/{analysisId}/findings` | 태그별 근거와 수정 제안, 최종 수정안(AI 초안 탭) |
| 상세 탐지 | GET | `/risk-analyses/{analysisId}/detector-results` | 검토 화면의 규칙·AI 분석 상태, 신뢰도, 복수 근거, 모델 정보. 실패하면 조회만 재시도 가능 |
| 추가 문의 초안 | GET / PUT | `/complaints/{id}/message-draft` | 교사 답변 후 학부모 작성 차례에 저장·복원. 반환된 숫자 `messageId` 사용. 기존 초안 수정 시 `expectedContentVersion` 필수(최초 저장은 생략) |
| 추가 문의 분석 | POST | `/complaints/{id}/messages/{messageId}/risk-analysis` | 최초 민원의 `/mask` 대신 메시지별 분석 내부에서 마스킹 |
| 추가 문의 전송 | POST | `/complaints/{id}/messages/{messageId}/send` | `{ expectedContentVersion }` 필수. 전송 완료 후 기존 로컬 대화에 한 번만 추가 |
| 제출 | POST | `/complaints/{id}/send` | 분석 뒤 내용이 바뀌었으면 서버가 최종 내용을 한 번 더 분석하고 제출 |
| 상태 | GET | `/complaints/{id}/status` | 제출 응답을 놓친 재시도에서 `COMPLAINT_NOT_DRAFT`가 오면 이미 제출됐는지 확인 |

## 흐름

1. **작성**: 자녀 → 문의 대상 → 제목·내용. 임시저장은 지금처럼 브라우저에만 저장합니다(서버 초안은 분석을 시작할 때 생김).
2. **AI 분석 시작**: 서버 초안이 없으면 `POST /complaints`, 있으면 본문이 바뀐 경우에만 `PATCH` → 서버 마스킹 → 분석 → findings. 단계마다 서버 초안 ID를 로컬 초안에 저장해, 중간에 실패해도 다시 시도할 때 같은 서버 초안을 씁니다. 마스킹이 실패하면 분석을 시작하지 않습니다. 분석 중 "문의 작성으로 돌아가기"를 눌러도 초안 생성 요청은 끊지 않고 끝까지 받아 연결합니다(삭제 API가 없어 끊으면 연결 없는 초안이 서버에 남음). 생성이 끝나기 전에 다시 분석하면(다른 화면에 갔다가 같은 초안을 다시 열어도) 같은 생성 요청을 기다립니다. 분석 중 `COMPLAINT_NOT_FOUND`가 오면 저장된 서버 초안 연결도 지웁니다. mock 모드에서 만든 검토 결과(서버 초안 없음)는 http 모드에서 작성 화면으로 돌려보내 다시 분석합니다.
3. **잠금**: 서버 초안이 생기면(생성 요청이 진행 중일 때도) 자녀·문의 대상·제목은 바꿀 수 없습니다. `PATCH`가 본문만 받기 때문이며, 화면에 안내 문구를 표시합니다.
4. **검토**: findings를 기존 검토 화면 모델로 바꿉니다. `GET /risk-tags`의 `code`·`name`으로 태그 명칭을 조회하고 로컬 아이콘을 붙입니다. 명칭 조회 실패 시 기존 표시명을 사용하며 분석·전송을 중단하지 않습니다. 이후, 근거 줄마다 항목 하나를 만들고 수정 제안이 있으면 "수정 제안: …"을 표시합니다. 서버 근거는 가린 문장 기준이라 원문 탭 강조도 가린 본문(`[전화번호]` 등)에 표시합니다. `LEGAL`이 있으면 기존 "공식 절차 의사 완화" 경고를 띄웁니다. 최종 수정안이 분석한 본문과 같거나 없으면 AI 초안 탭은 비활성입니다.
5. **전송**: 선택한 문장(AI 초안·원문·직접 수정)이 서버 내용과 다르면 `PATCH` 후 `send`합니다. 이때 확인 창에 "전송할 때 한 번 더 분석합니다" 안내가 나옵니다. 전송 뒤에는 접수 화면과 문의 내역이 아직 브라우저 저장소를 읽으므로 로컬 사본(`serverComplaintId` 포함)을 남깁니다.

검토 화면은 서버의 `riskScore`·`riskLevel`과 `finalRevision.reason`을 표시합니다. 상세 탐지는 `finalState`·`state`·`evidenceSpans`를 읽고, 이전 boolean·문자열 근거 응답도 지원합니다. 재분석이 제출 시점으로 미뤄진 경우 이전 본문의 상세 분석을 새 결과처럼 표시하지 않습니다.

### 추가 문의

서버에 제출한 로컬 문의 사본의 추가 문의 화면에서 `message-draft`를 조회·저장한 뒤 반환된 `messageId`로 분석합니다. 브라우저에 초안이 없으면 서버 초안을 복원합니다. 분석·전송 전에는 마지막으로 확인한 `contentVersion`을 `expectedContentVersion`으로 붙여 초안을 저장합니다. 내용이 같아도 저장해 버전을 확인합니다(같은 내용이면 서버가 버전을 올리지 않음). 전송에도 같은 버전을 보냅니다. 서버는 버전 검사와 저장·전송을 한 트랜잭션에서 처리하고, 어긋나면 409 `CONTENT_VERSION_CONFLICT`로 저장·전송하지 않습니다(학부모 차례가 아닌 409와 구분됨). 버전이 없는 예전 브라우저 초안은 서버 초안을 한 번 조회해 내용이 같을 때만 그 버전을 씁니다. 충돌 시 현재 입력을 유지하며 사용자가 `서버 초안 불러오기`로 전환할 수 있습니다. 전송 단계의 충돌은 검토 화면에서 안내하고, 작성 화면으로 돌아가 다시 분석하면 같은 충돌이 감지되어 불러오기 버튼이 나옵니다. 저장 응답을 놓친 재시도처럼 서버 초안이 이미 같은 내용이면 충돌로 보지 않고 그 초안을 이어 씁니다. 불러오기 응답을 기다리는 동안 새로 입력한 내용은 덮어쓰지 않습니다. 서버 저장·전송 여부의 최종 판단은 백엔드의 학부모 작성 차례 검증에 따릅니다.

전송 응답을 놓쳤거나 로컬 저장에 실패하면 `/messages`에서 **같은 서버 메시지 ID와 최종 본문**이 전송됐는지 확인해 복구합니다. 기존 문의가 OPEN이라는 이유만으로 추가 문의가 전송됐다고 판단하지 않습니다.

전송 실패 전에 저장이 성공하면 해당 본문·버전을 화면과 로컬 초안에 유지해 재시도가 잘못 충돌하지 않게 합니다. 로컬 대화에도 서버 메시지 ID를 기록해 두 탭의 서로 다른 로컬 초안이 같은 서버 메시지를 중복 표시하지 않습니다. 성공 응답의 메시지 ID·본문이 확인한 값과 다르면 로컬 성공 기록을 만들지 않습니다.

**참고:** 백엔드는 `expectedContentVersion` 누락도 `CONTENT_VERSION_CONFLICT`로 응답하므로, 응답 코드만으로는 다른 기기의 수정과 요청 누락을 구분할 수 없습니다.

### 분석 정책

- AI 검토는 메시지당 1회입니다. 분석 후 작성 화면으로 돌아가 본문을 고치고 다시 "AI 분석 시작"을 누르면 서버가 409 `FINAL_ANALYSIS_ON_SUBMIT`를 줍니다. 이때 검토 화면으로 넘어가되 새 수정안 없이 "전송할 때 수정한 내용을 한 번 더 분석합니다"를 안내합니다(`REANALYSIS_LIMIT_REACHED`도 같음).
- 재분석이 제한돼도 이미 성공한 `/mask`의 본문·버전은 유지합니다. 최종 수정 이유가 `null`이면 이유만 생략하고 수정문과 위험 근거는 그대로 표시합니다.
- findings 조회만 실패하면 분석은 저장돼 있어 전송할 수 있습니다. 검토 화면은 기존 "AI 수정안을 불러오지 못했습니다" 상태로 열립니다.
- 그 밖의 분석 실패(네트워크·500 등)는 서버 분석이 없어 제출이 거부되므로, 검토 화면으로 넘어가지 않고 작성 화면에서 다시 시도하게 합니다. mock 모드는 기존처럼 실패 상태로 검토 화면을 엽니다.

## 개인정보 마스킹

프론트 마스킹을 유지합니다. 서버로 보내는 제목·본문(`POST`·`PATCH`·추가 문의 `PUT`)은 전화번호·이메일·주민등록번호를 가린 문장입니다. 최초 민원은 `/mask`의 서버 마스킹 결과도 조회해 원문 검토·전송에 반영합니다. 서버는 받은 원문을 그대로 저장하고 LLM에 보낼 때만 따로 가린 사본을 쓰며, 교사 대화 조회(위험도 LOW)는 저장된 원문을 보여 주기 때문입니다.

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

- **생성 응답 유실**: `POST /complaints`가 서버에서 처리됐는데 응답이 시간 초과 등으로 오지 않으면 프론트는 서버 초안 ID를 알 수 없어, 다시 시도할 때 새 초안을 만들고 처음 것은 연결 없이 서버에 남습니다. 프론트만으로는 복구할 수 없어 백엔드와 재시도 식별자(같은 요청이면 기존 초안 ID 반환)나 작성 중 초안 조회·정리 API를 정해야 합니다.
- **학부모 문의 내역·상세·대화 조회**(`GET /complaints`, `/{id}`, `/messages`, `/close`): 화면은 아직 브라우저 사본을 읽으므로, 서버로 낸 문의에 교사가 답해도 학부모 화면에는 반영되지 않습니다.

## 코드

- `api/`: `parentComplaintTypes.ts`(DTO), `parentComplaintApiContract.ts`, `httpParentComplaintApi.ts`, `parentComplaintApi.ts`(모드). mock 모드는 DTO 수준 mock 대신 기존 `parentMessageApi.ts` 로컬 흐름을 씁니다(교사 메시지함과 같은 방식).
- `serverComplaint.ts`: 자녀 목록(`listServerChildren`), 교사 선택지, findings → 검토 모델(`toServerAnalysis`), 초안·분석(`analyzeServerDraft`), 제출(`submitServerDraft`).
- `useServerRecipients.ts`: 작성 화면의 자녀·교사 목록.
- `messageDraft.ts`: 로컬 초안의 `studentId`, `server`(서버 초안 ID·고정 필드·서버에 저장된 본문·분석 ID).

## 테스트

```bash
npx playwright test parent-message-api
npx playwright test --config=playwright.parent-http.config.ts
```

fetch를 대체해 요청 경로·메서드·본문, 마스킹한 본문 전송, PATCH 조건, 409 처리, 재시도 시 이미 제출된 민원 처리, findings 매핑을 확인합니다. 실제 서버 호출은 아닙니다. 기존 mock 화면 흐름은 `parent-message-write`·`parent-message-review` 테스트가 그대로 확인합니다. `.env.local`이 http 모드면 화면 테스트가 실패하므로 환경 변수를 덮어 실행합니다.

`playwright.parent-http.config.ts`는 HTTP 어댑터를 켠 데스크톱·모바일 화면에서 새 문의·추가 문의, 서버 마스킹 실패, 상세 탐지 재시도, 초안 충돌을 검사합니다. 백엔드 응답을 테스트 fixture로 대체하며 실서버 테스트와 구분합니다.

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

### 실서버 확인 (2026-10-30)

현재 배포된 OpenAPI에서 제공받은 Risk Analysis 5개 엔드포인트와 `finalState`·`state`·`evidenceSpans` 형식을 확인했습니다. 개발용 `parent@test.com` 계정으로 테스트 초안 complaintId **2**, analysisId **2**, 제목 `[테스트] Risk API HTTP 연동 확인 2026-10-30`을 생성했습니다. `/mask`·최초 `/risk-analysis`·`findings`·`detector-results`가 모두 **200**을 반환했고, 실제 화면에서 HIGH·60점·수정 이유·탐지 상태·근거·모델 정보를 확인했습니다. 이 초안은 제출하지 않았습니다.

서버 목록에는 당시 학부모 작성 차례(`waitingFor=PARENT`)인 테스트 민원이 없어 추가 문의의 실서버 성공 검증은 별도 준비가 필요합니다. 예전 수동 확인의 complaintId 2·3과 현재 ID를 같은 데이터로 간주하면 안 됩니다.
