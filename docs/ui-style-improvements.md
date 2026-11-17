# Issue #72 공통 UI 적용 및 검증

기준: `origin/dev`의 `175f2e3`에 포함된 [DESIGN.md](../DESIGN.md). 작업 브랜치: `feature/72-common-ui`.

## 적용한 디자인 기준

- 브랜드 블루 `#3b5bdb`, 기존 Pretendard 스택, 4px 간격 체계, 역할별 Sidebar 크기와 기존 화면 구조를 유지한다.
- 기본 control 8px, 큰 패널 12px, 카드 내부 24px·gap 16px, 섹션 간 32px을 기존 토큰으로 적용한다. 학부모 작성 화면의 큰 글자·입력 규격은 유지한다.
- 교사·관리자·학부모의 필수 보조 설명과 오류 텍스트 대비를 높이고, 상태 chip의 페이지별 중복 palette를 제거한다.
- 문서의 기존 값과 제안 값을 구분해 아래 제안을 실제 CSS에 선언했다. 기존 primary, danger, muted 원색 값과 위험 판정 함수는 보존한다.

## 신규 토큰 및 변경된 연결

| 토큰 | 값·출처 | 용도 |
| --- | --- | --- |
| `--color-text-muted-readable` | `#666666`, DESIGN.md 신규 제안 | 작은 메타·도움말 |
| `--color-text-danger-readable` | `#b91c1c`, DESIGN.md 신규 제안 | 오류·위험 글자 |
| `--color-danger-strong` | `#d9231f`, 기존 danger hover 재사용 | danger 버튼·긴급 badge 면 |
| `--color-border-control` / `--border-control` | 기존 `#888888` / 1px solid | 입력·선택·외곽 버튼 경계 |
| `--color-highlight` | 기존 `#fff180` | 원문 근거 강조 전용 |
| `--risk-low-bg/fg` | canvas / primary text | 기존 일반(Low) 회색 표시 |
| `--risk-medium-bg/fg` | warning subtle / primary text | 주의(Medium) 노랑 표시 |
| `--risk-high-bg/fg` | danger subtle / readable danger | 위험(High) 옅은 빨강 표시 |
| `--risk-emergency-bg/fg` | danger strong / inverse | 긴급(Emergency) 진한 빨강·흰 글자 |
| `--font-family-base` | 기존 Pretendard → Inter → system 스택 | 미정의 기본 서체 보완·중복 제거 |
| `--font-weight-bold` | 기존 semibold(700) 별칭 | 미정의 avatar 굵기 보완; semibold 값은 700 유지 |
| `--font-size-helper` | 기존 리터럴 14px | 공통 도움말 |
| `--radius-panel` | 기존 리터럴 12px | 큰 패널·확인창 |
| `--shadow-dialog` / `--shadow-toast` | 기존 그림자 리터럴 | 역할별 그림자 재사용 |
| `--transition-control` | 기존 field의 160ms ease | 색·경계 등 필요한 속성만 전환 |

`--color-text-danger`는 원색 danger 대신 readable danger에 연결했다. `--color-danger: #fd2d27`, `--color-text-muted: #888888` 자체는 유지한다. 새로운 spacing scale이나 위험 등급은 추가하지 않았다.

## 컴포넌트별 변경 및 호환성

| 영역 | 적용 내용 | 보존한 계약 |
| --- | --- | --- |
| Button / ButtonLink | 공통 hover·active·focus·disabled, danger 대비, 모바일 sm 44px, 위치 이동 없는 transition | Props·variant·size·loading·링크/행동 구분 |
| Badge / StatusChip / RiskBadge | 대비가 개선된 의미별 면·글자, 긴 label 줄바꿈, 페이지 고정 폭·중복 palette 정리 | 기존 등급명·riskVariant·처리 상태·선택 조건 |
| TextField / TextareaField / Select | control 경계·오류·focus 통일, 실제 렌더한 도움말/오류 id만 연결, 학부모 override에서도 오류 보존 | label·helperText·error·id·외부 aria-describedby·입력 제한 |
| Dropdown | 방향키·Home/End, disabled 건너뛰기, 선택/Escape 후 trigger focus 복귀, Tab/외부 클릭 닫기 | controlled/uncontrolled 값·onValueChange·기존 options |
| Modal / BoardConfirmDialog | 공통 focus hook, 초기 focus·Tab 순환·복귀·scroll lock·배경 inert; Board 확인창 portal | 기존 확인 문구·action·disabled·Escape/overlay 취소 정책 |
| Popover / Tooltip | Popover 이름·초기 focus·복귀; Tooltip Escape·포인터 유지·터치·화면 경계 보정·실제 trigger 설명 연결 | 기존 Props·placement; 필수 안내는 본문에 유지 |
| InformationTooltip | 기존 Tooltip을 감싼 18px Info·44px button; 교사 정보 카드에 적용 | 기존 AI 결과·최종 판단 정책 변경 없음 |
| Tabs / Accordion | 실제 존재하는 panel에만 aria-controls 연결, 공통 focus·hover | 키보드 전환·controlled API·기존 Accordion DOM id 보존 |
| Card / 정보 영역 | 기존 MessageContextCard·board 패널 재사용, 메타 wrap·간격 정리, 981px에서 제목이 사라지지 않도록 메타 별도 행 | 새로운 공통 Card·SidePanel·페이지 동선 도입 없음 |
| 전역 / shell | index.css에서 기반 CSS 1회 진입, 역할 layout의 중복 import·서체 정리, viewport 기반 최소 높이, reduced motion | breakpoint·Sidebar·기존 라우팅 유지 |

독립 리뷰에서 확인한 중첩 Tooltip Escape, 비활성 자식의 설명 접근, page hover specificity, 잘못 연결된 panel id를 보완했다. 부모 화면의 기존 하이라이트 → Accordion focus 연동을 위해 기존 DOM id 형식을 보존했다.

## 초판 구현 검증 결과 (`11b4113`)

초판 구현의 전체 실행 결과는 아래 표에 기록한다. 후속 학부모 화면 수정의 검증은 다음 절에서 구분한다. HTTP 테스트는 실제 HTTP 어댑터와 가로챈 응답을 사용하며, 실서버 검증과 구분한다.

| 검증 | 결과 |
| --- | --- |
| `npm run build` | 통과. Vite 500kB chunk 안내는 남음; bundle 분리는 이번 범위 밖 |
| `npm run lint` | 통과, 경고 없음 |
| `npm run test:auth -- --workers=2 --reporter=line --output=/tmp/issue72-full-results` | 460건 통과 (데스크톱·모바일, 공통 UI 20건·경계 폭 2건 포함) |
| `npx playwright test -c playwright.integration-http.config.ts --workers=2` | 8건 통과 |
| `npx playwright test -c playwright.parent-http.config.ts --workers=2` | 24건 통과 |
| `npx playwright test -c playwright.admin-http.config.ts --workers=2` | 12건 통과 |
| 공통 UI·학부모 highlight/draft·981px 상세 targeted 테스트 | 26건 통과; 최종 전체 실행에도 포함 |
| `git diff --check` | 통과 |

공통 UI 테스트는 Button/ButtonLink 상태, Dropdown 키보드·선택·Tab, 두 확인창의 초기 focus·Tab 순환·복귀·배경 차단, Tooltip hover/포인터 유지/Escape/모바일 touch/중첩 popup, Popover focus, field 설명 id·오류, Tabs, Accordion 연결, 위험 배지 텍스트 대비 ≥4.5:1, 320px·reduced motion을 확인한다.

기존 테스트로 위험도 검토·관리자 공유·승인 후 safetyLock 유지·명시적 잠금 해제·High 템플릿 제한·Emergency 전송 차단·원문 권한·마스킹 실패·API 오류/409·중복 전송 방지 등을 확인한다. 위험 판정·권한·API·안전 정책 파일은 변경하지 않았다.

### 시각 확인

`/browse`(Playwright 기반 실제 Chromium)로 변경 전후 교사 메시지함과 변경 후 교사 상세·학부모 작성·관리자 목록을 확인했다. 교사 목록/상세, 학부모 작성, 관리자 목록은 **320, 375, 620, 621, 820, 980, 981, 1240, 1440px**에서 가로 넘침을 확인했다. 긴 한국어 제목·sidebar 경계의 상세 카드 폭은 자동 회귀 테스트에도 포함했다. 최종 교사 상세 reload 후 console error는 없었다.

스크린샷은 로컬 `/tmp/issue72-before-inbox.png`, `/tmp/issue72-after-inbox.png`, `/tmp/issue72-after-detail.png`, `/tmp/issue72-mobile-detail.png`, `/tmp/issue72-parent-desktop.png`, `/tmp/issue72-parent-mobile.png`, `/tmp/issue72-admin-desktop.png`에 보관했다. 저장소에 screenshot baseline을 추가하지 않았으며 픽셀 diff 자동 비교는 수행하지 않았다.

### 실행하지 않은 항목·한계

- 추가 Codex CLI 리뷰는 로컬 기본 모델(`gpt-5.5`)의 ChatGPT 계정 미지원 오류로 완료하지 못했다. 독립 에이전트 리뷰와 그 후속 검토는 수행했고 발견 항목을 반영했다.

- 배포 환경·실제 백엔드와의 end-to-end 실행: 이번 검증은 mock 및 응답 interception 기반이다.
- 실제 모바일 기기, 화면낭독기, OS/브라우저 200% 텍스트 확대: 실행하지 않았다. Chromium 모바일 emulation과 320 CSS px 검증은 완료했다.
- 공통 테스트 fixture는 Vite 개발 서버 전용이며 product route나 production build entry를 추가하지 않는다.

## 제외한 후속 작업

화면 depth 축소, SidePanel 도입, 위험 분석·관리자 검토 화면의 기능별 UX 재설계, 상세 nav의 전면 Tabs 전환, Toast 정책 변경, API·백엔드·risk 판정·권한·safetyLock·전송 정책 변경, bundle 분리 및 폰트 self-host는 제외했다. 실제 공통화 필요가 확인되지 않은 Card 추상화도 추가하지 않았다.

## 학부모 작성 화면 피드백 반영

- 공통 md shell 규칙과 페이지 textarea 규칙의 우선순위 차이로 텍스트 시작선에 **40px 차이**가 발생했다. 수정 전 회귀 테스트에서 이를 재현했다.
- 페이지의 `--parent-field-inset`을 기존 spacing token에 연결해 Select·TextField·Textarea의 좌우 시작선을 통일했다. 기본은 `--space-6`(24px), 620px 이하에서는 `--space-4`(16px)이다.
- 이 화면의 기본 테두리는 `--color-border-default`(#a2a2a2), hover는 `--color-border-control`(#888888)을 재사용했다. 당시 기존 shadow를 유지했으며, 아래 추가 피드백에서 평상시 shadow를 제거했다. focus의 brand 경계·shadow와 오류의 readable danger 표시를 보존한다. 전역 토큰 값은 변경하지 않았다.
- 임시저장·AI 분석 버튼은 공통 `size="md"`(47px/16px)를 사용한다. 67px 높이·24px 글자·208/217px 최소 폭의 페이지 override를 제거하고 아이콘을 18px로 맞췄다. 모바일도 44px 이상의 조작 영역을 유지한다.
- 자녀 선택을 포함한 HTTP 4개 field와 mock 작성 화면을 320~1440px에서 점검했다. 자동 측정으로 텍스트 시작선 차이가 1px 이내인지, 버튼이 기본 높이를 유지하는지, 가로 넘침이 없는지 확인한다.

| 후속 검증 | 결과 |
| --- | --- |
| `npm run build` / `npm run lint` / `git diff --check` | 통과 |
| 학부모 작성·문의 내역·검토·공통 UI Playwright | 80건 통과 (desktop/mobile) |
| 학부모 HTTP Playwright | 26건 통과 (자녀 포함 4개 field 정렬·시각 확인 포함) |

이번 후속 수정은 학부모 작성 CSS·버튼 표현에 한정해 관련 테스트를 재실행했다. 초판 전체 테스트 460건과 다른 HTTP 구성 20건은 이번 수정 후 다시 실행하지 않았다.

시각 결과: `/tmp/issue72-followup-before.png`, `/tmp/issue72-followup-after.png`, `/tmp/issue72-followup-mobile.png`. HTTP 4개 field의 desktop/mobile screenshot은 `/tmp/issue72-followup-http-results`에 보관했다.

## CodeRabbit 리뷰 반영

첨부 8개와 채팅의 2개 리뷰를 대조했다. 포털 자손 리뷰가 첨부에서 3회 반복되어, 중복 2개를 합친 **8개 고유 항목을 모두 반영**했다. 미반영 항목은 없다.

| 항목 | 반영 내용 |
| --- | --- |
| Popover 제어된 닫힘의 focus 복귀 | `open=false` 전환 시 내부 focus를 trigger로 복귀한다. 외부 클릭·Tab으로 이미 이동한 focus는 유지한다. |
| Popover 포털 자손 | React capture 이벤트로 포털 자손의 pointerdown·focus를 내부 동작으로 인식한다. blur 판정은 새 focus 이동이 끝난 뒤 처리하며, 포털 모달의 Escape는 해당 모달이 처리한다. |
| Tooltip 설명 id 갱신 | cleanup에서 현재 `aria-describedby` 중 Tooltip 소유 id만 제거한다. 렌더링으로 갱신된 오류·도움말 id를 보존한다. |
| Tooltip pointer/focus 유지 | 실제 trigger·Tooltip의 hover와 현재 focus를 함께 확인한다. Tab으로 focus가 나가도 포인터가 설명 위에 있으면 표시를 유지한다. |
| 중첩 모달 inert·scroll 복원 | 활성 모달들이 최초 배경 상태를 공유한다. 아래 창을 먼저 닫아도 잠금을 유지하며, 마지막 창이 닫힐 때 원래 inert·scroll 상태를 복원한다. |
| 최상위 모달 Escape | 활성 모달 순서를 추적해 최상위 창만 키보드를 처리한다. 아래 창 종료가 위 창의 focus를 가져가지 않는다. |
| 마지막 Dropdown 옵션의 Tab | 음수 tabIndex로 focus된 옵션에서도 다음 Tab 정지점을 찾거나 처음으로 순환한다. 역방향 이동도 유지한다. |
| 모션 축소와 로그인 로딩 | 기존 정지 spinner와 `aria-busy`·중복 요청 차단을 유지하면서 요청 중 버튼 문구를 `로그인 중`으로 표시한다. |

새 회귀 테스트는 제어된 닫힘과 외부 Tab 이동, 자동 focus가 있는 포털 Modal, pointerdown, 오류 설명 id 갱신, pointer/focus 독립 유지, 모달 두 종료 순서와 원래 inert/scroll 복원, 최상위 Escape, Dropdown의 양방향 Tab을 확인한다. 기존 로그인 지연 테스트에는 reduced motion과 로딩 문구 검증을 추가했다.

| 최신 리뷰 수정 검증 | 결과 |
| --- | --- |
| 관련 UI·로그인 회귀 | 36건 통과 (desktop/mobile) |
| 전체 Playwright | 476건 통과 (desktop/mobile) |
| HTTP 통합·학부모·관리자 | 8 + 26 + 12 = 46건 통과. 최신 전체 검증 합계 522건 |
| build·lint·diff 검사 | 통과 (기존 chunk 크기 안내 유지) |

위 변경은 공통 UI 상호작용과 로그인 표시 문구에 한정했다. 이전에 조정한 학부모 입력 정렬·테두리·버튼 크기와 위험 판정·권한·API·safetyLock·전송 정책은 유지한다.

## 학부모 입력창 그림자 추가 피드백

- 실제 Chromium에서 TextField·Select·Textarea에 `#a2a2a2` 테두리와 `--shadow-sm`(검정 10%, blur 10px)이 함께 적용되는 것을 확인했다. 앞선 색상 조정 후에도 테두리 바깥이 어두워 보인 원인이다.
- DESIGN.md 5장의 면·구분선 우선 원칙에 따라 학부모 작성·추가 문의 입력창의 평상시 그림자를 제거했다. 기본 테두리 `#a2a2a2`, hover `#888888`, focus의 브랜드 경계·3px ring, 오류색, disabled 배경은 유지한다.
- 전역 `ui-input-shell`이나 그림자 토큰 값은 변경하지 않았다. 다른 역할 화면과 카드·Modal·Popover의 그림자에는 영향을 주지 않는다. 추가한 디자인 토큰은 없다.
- `/browse`로 1440px desktop과 375px mobile 화면을 확인했다. 세 입력 유형 모두 기본 `box-shadow: none`, focus는 `#3b5bdb`·3px ring, hover는 `#888888`·그림자 없음으로 확인했다. 320px·375px에서 가로 넘침과 console error가 없었다.
- 비교 화면은 `/tmp/issue72-flat-input-before.png`, `/tmp/issue72-flat-input-after.png`, `/tmp/issue72-flat-input-mobile.png`에 보관했다. 기존 입력 정렬·버튼 크기를 유지한다.
- 이번 추가 수정 후 build·lint·diff 검사가 통과했다. 공통 UI·리뷰 회귀·학부모 작성/내역/검토/API Playwright **146건**, 학부모 HTTP **26건**, 합계 **172건**이 통과했다. 앞 절의 전체 522건은 그림자 제거 전 결과이며, 이번에는 영향 범위의 기존 테스트를 재실행했다.

## 문의 작성 안내 및 동의 현황 피드백

### 문의 작성 안내

- 분석 전에만 상단 `문의 전 확인해 주세요`에서 자녀·문의 대상·제목 변경 제한을 한 문장으로 예고한다. 실제 제한이 없는 mock 새 문의에는 이 문구를 표시하지 않는다.
- 분석을 시작한 문의에는 입력 영역 위의 한 줄 상태 안내로 잠금 이유와 문의 내용 수정 가능 여부를 설명한다. 필드 아래의 잠금 설명 3개는 제거하고, 해당 필드의 `aria-describedby`를 공통 안내에 연결했다.
- 추가 문의는 분석 여부와 관계없이 대상·제목이 고정되므로 별도 문구를 사용한다. 필드별 조회 지연·실패·연결 없음·필수 입력 오류와 기존 잠금 조건은 유지한다.
- 재분석 시 서버 정책에 따라 새 수정안이 제공되지 않을 수 있어, 공통 안내는 내용 수정 가능 여부만 설명한다. 분석·전송 동작은 변경하지 않았다.

### 동의 현황

- 기본 설명을 `필수 약관과 선택 동의 내역을 관리하세요.`로 줄이고 14px 보조 글자로 표시한다. 20px 제목 아래 8px 간격, 설명과 상태 안내 사이 24px 간격을 사용한다.
- 사용자 행동 안내는 기존 `mypage-notice`와 Info 아이콘을 재사용한 별도 영역에 표시한다. 상태 제목은 16px/500, 설명은 14px, 배경은 기존 `--color-primary-subtle`이다.
- 서버의 저장된 값과 현재 체크 상태를 비교해 미동의·동의 완료·변경 미저장·저장 중·저장 완료를 구분한다. 저장 실패에는 기존 오류·재시도 동작을 유지하고, 체크만 한 상태를 동의 저장 완료로 표시하지 않는다.
- 정책 버전·동의 시점·필수/선택 동의 내역을 기존 canvas 면으로 묶는다. 체크 영역은 fieldset/legend로 구분하고, 필수·선택 Badge를 항목명 앞에 일정하게 배치했다.
- 각 항목의 설명은 기존 가입 화면의 안내를 재사용했다. 선택 동의 거부 시에도 이용 가능하다는 안내를 선택 항목에 연결하고, 체크박스의 이름·설명을 각각 연결했다.
- 중복된 하단 안내와 겹치는 구분선을 정리했다. 체크 행 20px padding, 설명 gap 8px, 영역 간 24px, 카드 padding 24px(모바일 20px/16px)을 기존 토큰으로 적용했다. 모바일 저장 버튼은 전체 폭을 사용한다.
- 기존 `requiredAgreed: true` / `optionalAgreed` 저장 계약, 필수 미체크·저장 중 버튼 비활성화, 조회·저장·재시도 로직은 유지했다. 새 토큰과 API는 추가하지 않았다.

참고: [토스 TDS AgreementV4](https://tossmini-docs.toss.im/tds-mobile/components/Agreement/v4/)의 항목·필수 여부·설명 계층, [네이버 공개 가입 동의 화면](https://nid.naver.com/account/signup/term?lang=ko_KR)의 항목별 필수/선택 표시, [카카오 공개 가입 동의 화면](https://accounts.kakao.com/weblogin/create_account/?lang=ko#confirmTerm)의 선택 거부 가능 안내를 확인했다. 이 배치 원칙만 참고하고 브랜드 색상·컴포넌트 라이브러리는 기존 것을 사용한다.

당시에는 약관 전문을 여는 실제 URL·본문이 코드와 동의 API에 없어 보기 링크를 추가하지 않았다. 이후 사용자가 3종의 본문을 제공하여 아래 「대화 안내 크기 정렬과 약관 전문 모달」에서 전문 연결을 반영했다.

### 이번 수정의 검증

- build·lint·diff 검사 통과. 기존 chunk 크기 안내 유지.
- 전체 Playwright 476건 통과. 아래 HTTP 50건과 합쳐 이번 코드의 전체 검증은 **526건 통과**했다. 스크린샷 저장 방식을 전체 화면으로 보완한 뒤 해당 회귀 6건도 다시 통과했다(526건과 중복 집계하지 않음).
- HTTP 통합 8건, 학부모 HTTP 30건, 관리자 HTTP 12건 통과. 동의 상태·저장 실패·저장 중·선택 변경·새로고침과 문의 분석 전후·추가 문의의 잠금 유지·안내 연결을 확인했다.
- 실제 Chromium에서 동의 화면의 1440px desktop·375px mobile을 시각 확인하고 320px 가로 넘침을 점검했다. HTTP 회귀에서도 동의 화면은 320/375/620/980/1440px, 잠긴 문의는 320/375/1440px을 확인한다.
- 동의 전후 화면: `/tmp/issue72-consent-before.png`, `/tmp/issue72-consent-after-desktop.png`, `/tmp/issue72-consent-after-mobile-full.png`. HTTP 화면은 `/tmp/issue72-consent-http-results`, `/tmp/issue72-consent-parent-results`에 보관한다. 최종 모바일 전체 화면은 `/tmp/issue72-consent-final-shots`, `/tmp/issue72-parent-final-shots`에 보관한다.
- HTTP 검증은 응답 interception 기반이다. 실서버·실기기·화면낭독기 검증은 실행하지 않았다.

## 새 문의 작성의 점진적 안내 개선

앞 절의 상단 공통 안내·잠금 박스 배치를 아래 구성으로 개선했다. 기존 안내의 의미와 입력·분석·마스킹·전송 조건은 유지한다.

| 영역 | 변경 전 | 최종 적용 |
| --- | --- | --- |
| 유의사항 | 모든 내용을 담은 큰 회색 카드 | 기존 공통 Accordion 재사용, 기본 접힘. `문의 작성 시 유의사항`과 `문의는 전송 후 수정하거나 삭제할 수 없습니다.`는 항상 표시 |
| 세부 안내 | 배려·폭언/욕설·금융사기 안내를 항상 표시 | 펼친 영역의 3개 항목으로 유지. 마우스·Enter·Space로 조작, 공통 focus·hover·expanded 아이콘 재사용 |
| AI 변경 제한 | 상단 유의사항과 입력 위 잠금 박스 | 분석 버튼 위 12px 간격의 14px inline 안내. 배경·padding·외곽선을 제거하고 Info/Lock 아이콘과 기존 readable muted 사용 |
| 간격 | 안내-폼 48px, field gap 32px 및 추가 문의의 별도 큰 간격 | 안내-폼·field gap 24px, footer 내부 12px, Accordion padding 16px. 기존 spacing token 재사용 |
| 최종 확인 | 제목·마스킹된 최종 내용·수정/삭제 불가 안내·취소/확인 후 전송이 있는 공통 Modal | 기존 구현을 그대로 재사용. 취소 후 내용 유지·전송 미실행을 테스트로 확인 |

- HTTP 새 문의에는 분석 전후 모두 `AI 분석을 시작하면 자녀·문의 대상·제목은 변경할 수 없습니다. 문의 내용은 계속 수정할 수 있습니다.`를 표시한다. 실제 잠금은 기존처럼 서버 초안 생성 중/생성 후 적용되며, 분석 실패로 작성 화면에 돌아와도 유지한다.
- 실제 제한이 없는 mock 새 문의에는 위 문구를 표시하지 않는다. 추가 문의는 기존 대상·제목을 유지한다는 별도 안내를 같은 footer에 표시한다. 입력·분석 버튼의 설명 id는 실제 inline 안내에 연결했다.
- 임시저장, 입력값·분석 결과, 활성/비활성 조건, API 및 개인정보 마스킹 함수는 변경하지 않았다. 공통 Accordion/Modal의 Props와 구현에도 변경이 없다. 새 디자인 토큰은 추가하지 않았다.
- 1440px 실제 Chromium에서 기본 접힘 높이 83px을 확인했다. 375px 접힘·펼침과 키보드 focus, Enter·Space 조작을 시각 확인했다. 320~1440px 가로 넘침과 분석 버튼 가까이의 안내 배치는 회귀에서도 확인한다.
- 모달 확인에서는 제목과 실제 선택·마스킹 문장을 검증하고, 취소 시 editor 값 유지·전송 내역 미생성, 다시 확인 후 전송 시 중복 전송 방지를 확인한다.
- 변경 전후 화면: `/tmp/issue72-disclosure-before.png`, `/tmp/issue72-disclosure-after.png`, `/tmp/issue72-disclosure-expanded.png`, `/tmp/issue72-disclosure-mobile.png`, `/tmp/issue72-disclosure-mobile-expanded.png`. HTTP 분석 전후 화면은 `/tmp/issue72-disclosure-http-results`에 보관한다.

### 최종 검증

| 검증 | 결과 |
| --- | --- |
| build·lint·diff 검사 | 통과. 기존 500kB chunk 안내 유지 |
| 인증·UI 전체 Playwright | mock 모드를 명시한 격리 서버에서 **478건 통과** (desktop/mobile) |
| HTTP 통합·학부모·관리자 | 8 + 30 + 12 = **50건 통과** |
| 합계 | 최종 코드 기준 **528건 통과** |

최초 전체 실행에서는 기존 교사 검토 2건이 상태 대기에서 실패했다(476건 통과). 코드 변경 없이 단독 재실행 2건과 최종 격리 전체 478건이 모두 통과했다. 간헐 실패의 정확한 원인은 확정하지 않았으며 교사 검토·안전 정책 코드는 변경하지 않았다. 중간 격리 실행은 `.env.local`의 HTTP 설정을 읽은 것이 확인되어 중단하고 검증에 집계하지 않았다. 최종 실행은 브라우저 제공 환경의 AUTH/MESSAGE/ESCALATION 모드가 모두 mock임을 확인한 뒤 수행했다.

키보드 테스트는 실제 Tab 이동으로 focus-visible을 확인한다. 화면 폭 전환 시 간격은 기존 shell padding transition이 끝날 때까지 기다린 뒤 같은 frame에서 측정한다. 최종 전체 로그는 `/tmp/issue72-disclosure-auth-verified.log`, HTTP 로그는 `/tmp/issue72-disclosure-{integration,http,admin}.log`에 보관한다. 실서버·실기기·화면낭독기 검증은 실행하지 않았다.

## 작성 화면 간격·배경·반응형 세부 조정

이번 조정의 실제 UI 변경은 `ParentMessageComposer.css` 한 파일에 한정했다. HTML·TSX·문구·공통 Accordion·입력/임시저장/AI/마스킹/API 로직은 변경하지 않았다.

| 요청 | 적용 및 확인 |
| --- | --- |
| 아코디언과 폼 구분 | 폼 위 margin을 desktop/tablet `--space-8`(32px), 620px 이하 `--space-6`(24px)로 적용 |
| 하나의 카드 표현 | 카드·Panel을 기존 canvas `#f8f8f8`로 통일. 1px divider·8px radius 유지, 펼치면 Trigger는 위쪽·Panel은 아래쪽 모서리를 담당 |
| Hover 범위 | Trigger만 기존 primary-subtle `#ebeffb`로 강조. Panel은 hover 중에도 canvas 유지. 기존 common focus·expanded 아이콘 동작 유지 |
| 모바일 헤더 | 작성 main과 인접한 헤더만 선택해 620px 이하에서 제목/crumb를 세로 배치하고 gap 12px 적용. 621~820px 행 배치 gap은 16px. 다른 검토·전송 완료 헤더와 1024/1440px desktop 헤더는 유지 |
| AI 안내 줄바꿈 | 원인인 `max-width:65ch`를 제거하고 Grid 행 전체 폭을 사용. desktop은 flex-end 정렬, 모바일은 start 정렬. nowrap·생략 없이 여유 폭에 따라 줄바꿈 |

실제 Chromium에서 펼친 카드-폼 gap 32px, 모바일 제목-crumb gap 12px·카드-폼 24px·가로 넘침 없음을 확인했다. Trigger hover는 `#ebeffb`, Panel은 `#f8f8f8`로 측정했다. HTTP 화면은 375/768/1024/1440px에서 시각 확인했고, 1440px AI 설명 한 줄은 텍스트 Range로 자동 검증한다. 모바일은 자연스럽게 줄바꿈하며 버튼과 겹치지 않는다.

- 이번 실행: build·lint·diff 검사 통과, 관련 인증/UI Playwright **148건** + 학부모 HTTP **30건** = **178건 통과**. 전체 528건은 직전 구조 개선의 결과이며 이번 CSS 조정 후 전체를 재실행하지 않았다.
- 기존 헤더 테스트를 모바일 세로/desktop 행 배치 기준으로 갱신했고, 같은 frame에서 좌표를 측정한다. 기존 HTTP 회귀의 화면 폭과 스크린샷 범위를 확장했다. 테스트 추가·새 토큰·공통 컴포넌트 변경은 없다.
- 비교 화면: `/tmp/issue72-spacing-before-1440.png`, `/tmp/issue72-spacing-after-1440.png`, `/tmp/issue72-spacing-after-expanded-1440.png`, `/tmp/issue72-spacing-after-375.png`.
- 네 폭의 최종 HTTP 화면: `/tmp/issue72-spacing-after-{375,768,1024,1440}-http.png`. 로그는 `/tmp/issue72-spacing-{build,lint,auth,after}.log`, 회귀 artifact는 `/tmp/issue72-spacing-auth-results`, `/tmp/issue72-spacing-after-results`에 보관한다. HTTP는 응답 interception 기반이며 실서버·실기기 검증은 실행하지 않았다.

## 아코디언 상태·AI 분석 작업 그룹 후속 개선

이 절은 `4b1d131` 시점의 변경·검증 기록이다. AI 안내의 최종 표시 방식은 다음 절의 단일 안내로 대체했다. 당시 변경은 작성 화면 TSX·CSS, 기존 회귀 테스트 2개, 이 결과 문서의 총 5개 파일에 한정했다. 공통 Accordion·Popover 구현과 기능/API 코드는 변경하지 않았다.

| 영역 | 변경 전 | 개선 결과 |
| --- | --- | --- |
| 아코디언 Hover | 포인터가 헤더에 머무르면 파란 배경이 남아 Expanded와 혼동 | canvas와 divider 토큰을 혼합한 연한 중립색을 Hover 가능한 기기의 Trigger에만 적용 |
| Focus·Expanded | 전역 focus-visible 외곽선과 Hover가 겹침 | 마우스 Focus에는 외곽선을 추가하지 않고, 키보드 focus-visible에는 기존 2px 브랜드색 표시를 헤더 안쪽에 유지. Expanded는 화살표 회전과 콘텐츠 노출로 표현 |
| 카드 연결 | 파란 Trigger와 회색 Panel이 분리되어 보임 | 기존 canvas·1px divider·8px radius 유지, Panel에는 Hover 없음. 접힘·펼침 모두 폼과 desktop 32px·mobile 24px 간격 |
| AI 안내 | 두 문장의 설명이 버튼 위 별도 행에 표시 | `분석 시작 후 자녀·문의 대상·제목은 변경할 수 없습니다.`를 항상 표시하고 정보 아이콘·분석 버튼과 같은 작업 그룹으로 배치 |
| 상세 설명 | 항상 노출 | 기존 Popover로 `AI 분석을 시작하면 자녀·문의 대상·제목은 변경할 수 없으며, 문의 내용은 계속 수정할 수 있습니다.` 제공. 클릭·Enter·Space로 열고 Escape·바깥 클릭으로 닫음 |
| 하단 간격 | Grid gap과 개인정보 카드의 top margin이 중복 | 작성 폼 안에서만 카드 margin을 제거. 폼-카드·카드-작업 영역은 각각 24px. 개인정보 카드의 내용·의미·형태 유지 |
| 반응형 | 안내와 버튼이 별개 행 | desktop은 저장 왼쪽·분석 작업 그룹 오른쪽, 충분한 폭에서는 설명도 한 줄. 620px 이하에서는 저장·안내·분석 버튼을 세로 배치하고 버튼 전체 폭·47px 높이·정보 버튼 44px 터치 영역 유지 |
| 모바일 헤더 | 직전 수정의 제목/crumb 세로 배치 | 기존 12px 간격과 정렬을 재검증하고 유지. desktop 헤더 변경 없음 |

[IBM Carbon Accordion 가이드](https://www.carbondesignsystem.com/building-blocks/core/components/accordion/guidelines)의 헤더 클릭 영역, Hover/Focus와 펼침 상태의 구분, 화살표·콘텐츠로 상태를 표현하는 패턴을 참고했다. 서비스의 색상과 토큰은 `DESIGN.md`를 우선했다. 신규 토큰은 없으며, helper 14px·readable muted·space 4/8/12/24/32px·canvas·divider·focus·radius 토큰을 재사용한다.

제한 안내는 기존 HTTP 새 문의에만 표시한다. 실제 잠금은 기존대로 서버 초안 생성 중/생성 후 적용되며 분석 실패 후에도 유지된다. 추가 문의는 기존 대상·제목을 유지하는 별도 안내를 보존하고, 제한이 없는 mock 새 문의에는 잘못된 잠금 안내를 표시하지 않는다. 입력과 분석 버튼의 `aria-describedby`는 항상 노출된 핵심 문구에 연결한다. 임시저장·입력값·분석 결과·마스킹·전송·확인 모달·권한·위험도·안전 정책은 변경하지 않았다.

### 이번 검증과 비교 자료

- build·lint·diff 검사 통과. 기존 500kB chunk 안내는 유지된다.
- 회귀 검사를 먼저 변경해 기존 구현에서 짧은 핵심 안내/정보 버튼 검사가 실패함을 확인한 뒤 수정했다. Accordion 마우스/키보드·접힘/펼침 간격과 Popover 열기/닫기·Focus 복귀·분석 전후 잠금·다섯 폭의 배치/넘침 검사를 통과했다.
- 375·768·1024·1440px의 HTTP 화면을 시각 확인하고 320px도 자동 점검한다. 1440px 설명 한 줄은 텍스트 Range로 확인한다. Popover는 375/1440px에서 시각 확인하고 모든 폭에서 화면 안에 표시되는지 검사한다.
- 변경 전 자료: `/tmp/issue72-action-before-hover.png`, `/tmp/issue72-action-before-{375,1440}.png`. 변경 후: `/tmp/issue72-action-accordion-{hover,expanded,keyboard}.png`, `/tmp/issue72-action-after-{375,768,1024,1440}.png`, `/tmp/issue72-action-info-{375,1440}.png`. 원본은 `/tmp/issue72-action-final-visual-results`에 보관한다.
- 최종 인증/UI 전체 **478건 통과** + HTTP 학부모 30건·API 통합 8건·관리자 12건의 **50건 통과** = 현재 코드 기준 **528건 통과**. 최초 인증/UI 전체 실행은 **477건 통과·1건 실패**였다. 기존 `admin-escalation.spec.ts`의 공유하지 않은 긴급 메시지 승인 대기 표시 검사가 실패했고, 코드 변경 없이 desktop/mobile 단독 재실행 **2건 통과** 및 다른 HTTP 실행 종료 후 전체 **478건 통과**를 확인했다. 간헐 실패의 정확한 원인은 확정하지 않았고 해당 기능·정책 코드는 수정하지 않았다.
- 로그: `/tmp/issue72-action-{build,lint,final-lint,auth,auth-final,http,integration,admin-http,admin-recheck}.log`. 최종 시각 검사 2건과 테스트 TypeScript 검사도 통과했다.
- HTTP 검증은 응답 interception 기반이다. 실서버·실기기·화면낭독기·200% 실제 확대·자동 픽셀 diff는 미실행이다. 변경 전후 스크린샷은 직접 비교했다.

## 새 문의 작성의 균형·단일 안내·액션 그룹 정리

이 절은 `9250ae5` 시점의 변경·검증 기록이다. 하단 안내와 툴팁의 최종 표시는 다음 절에서 조정했다. 당시 수정은 Composer TSX/CSS·기존 학부모 HTTP 회귀 테스트·결과 문서의 총 4개 파일에 한정했다. 공통 컴포넌트·전역 CSS·API·입력/저장/분석/마스킹/전송 함수는 변경하지 않았다.

| 요소 | 최종 적용 |
| --- | --- |
| 라벨과 필드 | desktop 라벨 160px, 1240px 이하 140px와 gap 24px. 일반 라벨은 수직 중앙, 내용 라벨은 상단. 820px 이하에서 기존 세로 배치 유지 |
| 내용 입력창 | desktop 224px, 820px 이하 200px. 최소 높이 200/160px, 세로 resize 유지. 기본 rows는 6으로 조정하고 입력값은 보존 |
| 개인정보 상태 | textarea 아래 16px, desktop 입력 열과 시작선 일치. 작성 화면에서만 큰 면·전체 테두리·padding 제거. 결과 제목·기존 warning Badge·보조 설명·접힌 마스킹 미리보기의 계층 유지 |
| 개인정보 의미 | 입력이 모두 비면 안내 없음. 실제 동기 탐지 결과가 0건이면 중립, 탐지 시 노란 왼쪽 표시와 기존 warning Badge, 실패 시 붉은 표시·alert·재시도 유지 |
| 하단 | 개인정보 상태 아래 24px. 안내 한 번 → 16px → 임시저장·AI 분석 시작. 두 버튼은 오른쪽 정렬·gap 12px·47px 높이·내용에 맞는 폭. 좁아지면 필요한 경우에만 flex wrap |
| AI 안내 | Popover·정보 버튼의 반복 설명 제거. 장식 Info 아이콘과 14px readable muted 본문을 버튼 위 별도 행에 표시. 입력과 분석 버튼의 설명 id는 이 문구에 연결 |
| 헤더·아코디언 | 제목/crumb 다음 32px(620px 이하 24px), 아코디언-폼 32px(620px 이하 24px), 필드 gap 24px. 아코디언 제목은 기존 primary text·굵은 서체, 설명은 secondary text. 중립 Trigger Hover·키보드 Focus·Expanded 표현 유지 |

HTTP 새 문의 안내는 다음 한 문장 블록으로 표시한다.

> AI 분석은 문의를 전송하지 않습니다. 분석 시작 후 자녀·문의 대상·제목은 변경할 수 없으며, 문의 내용은 계속 수정할 수 있습니다.

분석 함수는 초안 생성·분석 후 검토 화면으로 이동하고, 검토 화면의 확인 모달에서 별도 전송 함수를 호출하므로 문구가 실제 흐름과 일치한다. HTTP 잠금은 기존대로 서버 초안 생성 중/생성 후 유지된다. 실제 잠금이 없는 mock 새 문의에는 전송 단계 설명만 제공하고, 추가 문의의 기존 대상·제목 유지 안내도 보존했다. `DESIGN.md` 11.6에 따라 중요한 안내를 본문에 한 번만 표시하며, 키보드로 중복 팝오버를 조작할 필요가 없다. 신규 토큰은 없고 페이지 전용 라벨 열 변수와 기존 typography·spacing·의미별 색상을 사용한다.

- 집중 회귀 4건 통과: 단일 안내·분석 후 전송 API 미호출·입력 잠금/본문 수정 가능 여부·설명 id, 빈 입력/0건/탐지 상태·미리보기, 라벨 폭·중앙 정렬·필드 시작선·입력창 높이·간격·오른쪽 버튼 그룹을 확인했다.
- 375·768·1024·1440px를 시각 확인했고, 320·620·820·980·1240px도 자동 점검한다. 최종 화면: `/tmp/issue72-balance-{375,768,1024,1440}.png`(분석 후 잠금), `/tmp/issue72-balance-form-{375,768,1024,1440}.png`(편집 가능). 빈 입력·0건 상태는 `/tmp/issue72-balance-parent-{empty,privacy-neutral}.png`에 보관한다. 원본은 `/tmp/issue72-balance-http-results`와 `/tmp/issue72-balance-final-visual-results`에 있다.
- 최종 `npx tsc -b`·`npm run lint`·`npm run build`·diff 검사 통과. 기존 500kB chunk 안내는 유지된다. 인증/UI 전체 **478건** + HTTP 학부모 **30건**·API 통합 **8건**·관리자 **12건** = 현재 코드 기준 **528건 통과**. 앞선 단일 안내 단계의 결과는 합산하지 않았다. 로그: `/tmp/issue72-balance-{typecheck,lint,build,auth,http,integration,admin}.log`.
- HTTP는 응답 interception 기반이다. 실서버·실기기·화면낭독기 검증은 미실행이다.

## 작성 화면 하단 안내와 정보 툴팁

전체 폼·textarea·간격 토큰은 유지하고 하단의 설명 밀도를 줄였다. 변경 파일은 Composer TSX/CSS, 기존 `PrivacyMaskingNotice.tsx`, 학부모 HTTP 회귀 테스트, 이 문서의 총 5개다. 기존 `InformationTooltip`을 재사용하며 Tooltip 자체·전역 CSS·검사/저장/API 로직은 변경하지 않았다.

| 영역 | 적용 |
| --- | --- |
| 개인정보 안내 | textarea 바로 아래 기존 인라인 위치 유지. 작성 화면에서만 `compact` 표시를 사용하며, 입력이 없으면 안내 없음·0건 작성 단계는 `개인정보를 확인해 주세요.`와 중립 Shield 아이콘 표시. 검사 완료/성공을 암시하는 문구 제거 |
| 개인정보 툴팁 | `전화번호·이메일·주민등록번호를 자동으로 확인합니다. 이름·주소 등 다른 개인정보가 포함되어 있는지도 직접 확인해 주세요.` 제공. 기존 두 번째 줄과 반복된 보조 설명을 정보 아이콘으로 이동 |
| 실제 탐지/실패 | 탐지 경고·건수 Badge·마스킹 문장 사용 안내·결과 미리보기 유지. 실패의 alert·전송/분석 중단 안내·재시도도 유지. `compact` 기본값은 false여서 검토 화면의 기존 결과 표시는 보존 |
| AI 안내 | 화면에는 `AI 분석은 문의를 전송하지 않습니다.`만 표시. 인접한 정보 아이콘에서 `분석 시작 후 자녀·문의 대상·제목은 변경할 수 없으며, 문의 내용은 계속 수정할 수 있습니다.` 확인. 잠금이 없는 mock에는 전송 절차 설명만 제공하고 추가 문의의 기존 안내는 보존 |
| 레이아웃 | desktop은 안내 왼쪽·기존 outline/primary 버튼 오른쪽의 한 행. 820px 이하에서는 안내를 버튼 위에 배치. 개인정보-하단 gap 24px·모바일 안내-버튼 gap 16px·버튼 gap 12px 유지 |
| Select | 실제 disabled 조건과 표시를 대조. 활성 shell은 white, 분석 후 잠금/선택 항목 없음은 기존 disabled canvas 유지. 임의로 활성화하거나 색상만 바꾸지 않음 |

툴팁은 기존 44px 정보 버튼·hover·focus·터치·Escape·바깥 pointer 닫기·화면 경계 보정을 재사용한다. 버튼과 필드의 `aria-describedby`가 읽는 전체 잠금 설명은 기존 `sr-only`로 보존한다. 화면에는 짧은 문구만 보이고 상세 설명은 요청할 때 확인할 수 있다. 분석과 최종 전송은 기존처럼 별도 단계이며 분석만 실행했을 때 전송 API가 호출되지 않는지 재검증했다.

- 집중 회귀 4건 통과: 두 툴팁의 focus/hover/터치·Escape·외부 클릭, 320~1440px 화면 경계·배치, Select 활성/disabled의 실제 색상, 빈 입력·중립/탐지·마스킹 미리보기·분석 전후 잠금/본문 수정 가능 여부를 확인했다. 모바일 외부 터치 닫기도 전체 HTTP 회귀에서 검증한다.
- 375·768·1024·1440px 시각 비교: `/tmp/issue72-footer-{375,768,1024,1440}.png`, 0건 중립 표시: `/tmp/issue72-footer-neutral.png`. 툴팁: `/tmp/issue72-footer-{analysis,privacy}-tooltip-{375,1440}.png`. 원본은 `/tmp/issue72-footer-final-visual-results`에 보관한다.
- Lint·앱 typecheck·Build 통과. 최종 인증/UI 전체 478건 + HTTP 학부모 30건/통합 8건/관리자 12건의 50건 = 현재 코드 기준 **528건 통과**. 첫 인증/UI 전체 실행은 476건 통과·2건 실패였다. 교사 위험도 검토의 완료 상태 표시 검사와 학부모 추가 문의 대화 흐름의 30초 제한 초과는 코드 변경 없이 각각 desktop/mobile 단독 재실행 2건씩 및 최종 전체 478건을 통과했다. 정확한 간헐 실패 원인은 확정하지 않았고 관련 기능·안전 정책은 수정하지 않았다. 로그: `/tmp/issue72-footer-{typecheck,lint-final,build,auth,auth-final,teacher-recheck,history-recheck,http,integration,admin}.log`. 이전 단계의 실행 건수는 이번 결과에 합산하지 않는다.
- React 스킬 기준으로 새 효과/상태 없이 기존 컴포넌트·파생 값을 사용하고, optional Props의 기본 동작과 native button·focus·설명 id를 유지했는지 검토했다.
- HTTP는 응답 interception 기반이다. 실서버·실기기·화면낭독기 검증은 미실행이다.

## 수정 파일 목록

- `README.md`
- `docs/ui-style-improvements.md`
- `src/App.css`
- `src/features/admin/AdminPages.css`
- `src/features/auth/MyPagePanel.css`
- `src/features/auth/PolicyConsentPanel.tsx`
- `src/features/message/components/BoardConfirmDialog.tsx`
- `src/features/message/components/MessageContextCard.tsx`
- `src/features/message/messages/MessagesPage.base.css`
- `src/features/message/messages/MessagesPage.conversation.css`
- `src/features/message/messages/MessagesPage.detail.css`
- `src/features/message/messages/MessagesPage.escalation.css`
- `src/features/message/messages/MessagesPage.list.css`
- `src/features/message/messages/MessagesPage.modals.css`
- `src/features/message/messages/MessagesPage.responsive.css`
- `src/features/message/messages/MessagesPage.risk.css`
- `src/features/message/messages/MessagesPage.shared.css`
- `src/features/message/messages/MessagesPage.templates.css`
- `src/features/parent-message/ParentMessageComposer.css`
- `src/features/parent-message/ParentMessageComposer.tsx`
- `src/features/parent-message/ParentMessageHistory.css`
- `src/features/parent-message/ParentMessageReview.css`
- `src/features/pii/PrivacyMaskingNotice.tsx`
- `src/index.css`
- `src/layouts/AdminLayout.tsx`
- `src/layouts/ParentLayout.tsx`
- `src/layouts/TeacherLayout.tsx`
- `src/pages/common/LoginPage.tsx`
- `src/shared/components/teacher-shell/TeacherSidebar.css`
- `src/shared/components/ui/Accordion.tsx`
- `src/shared/components/ui/Dropdown.tsx`
- `src/shared/components/ui/Modal.tsx`
- `src/shared/components/ui/Popover.tsx`
- `src/shared/components/ui/Select.tsx`
- `src/shared/components/ui/Tabs.tsx`
- `src/shared/components/ui/TextField.tsx`
- `src/shared/components/ui/Tooltip.tsx`
- `src/shared/components/ui/index.ts`
- `src/shared/components/ui/useModalFocus.ts`
- `src/shared/styles/teacher-prototype.css`
- `tests/auth/auth-flow.spec.ts`
- `tests/auth/common-ui.spec.ts`
- `tests/auth/parent-message-history.spec.ts`
- `tests/auth/parent-message-review.spec.ts`
- `tests/auth/parent-message-write.spec.ts`
- `tests/auth/ui-layout.spec.ts`
- `tests/auth/ui-review-regressions.spec.ts`
- `tests/fixtures/common-ui.html`
- `tests/fixtures/common-ui.tsx`
- `tests/integration/api-flows.spec.ts`
- `tests/parent/risk-http.spec.ts`
- `tsconfig.playwright.json`

## 작성·대화 화면의 글자 위계와 도움말 배치 (2026-11-17)

첨부된 학부모 작성 화면을 기준으로 [Mobiinside의 서비스 가이드 사례](https://www.mobiinside.co.kr/2022/05/13/service-guide/), [Carbon Tooltip](https://carbondesignsystem.com/components/tooltip/usage/), [Fluent Tooltip](https://fluent2.microsoft.design/components/web/react/core/tooltip/usage)을 참고했습니다. 관련 작업 가까이에 보조 설명을 두고 필수 안내는 화면에 남긴다는 원칙을 적용했습니다. 아래 크기·간격은 해당 글의 수치 명세가 아니라 `DESIGN.md`와 기존 토큰에 근거한 프로젝트의 적용 값입니다.

- 학부모 작성 라벨·입력을 16px/24px로 맞췄습니다. 데스크톱의 기존 라벨 24px·입력 20px과 모바일 라벨 20px을 본문 위계로 정리하고 입력창 높이·정렬은 유지했습니다.
- 개인정보와 AI 분석 안내는 입력창 아래 16px의 같은 영역에 배치합니다. 충분한 폭에서는 한 줄, 좁은 폭에서는 같은 시작선에 세로로 표시하고 버튼은 그 아래 16px에 둡니다. 보조 문장은 14px/20px이며 개인정보 제목의 과한 굵기를 줄였습니다.
- 공통 Information 아이콘은 16px, 실제 버튼은 44×44px입니다. 라벨 바로 옆에 보이도록 아이콘의 시각적 간격을 보정해 학부모 작성·교사 대화 위험도·위험도 검토에서 같은 규칙을 사용합니다.
- 툴팁은 14px/20px, 최대 280px로 읽기 폭을 확보하고 화면 양끝의 16px 여백을 유지합니다. 한국어는 어절 단위로 줄바꿈하고 긴 단어는 화면을 넘지 않게 처리합니다.
- 짧은 보충 설명만 툴팁에 둡니다. 개인정보 경고·마스킹 실패·분석과 전송의 구분·잠금 사유와 기존 접근성 설명은 본문에 유지합니다. hover·focus·터치·Escape·외부 클릭·화면 경계 보정 동작과 API·위험도·권한·안전 잠금·전송 조건은 변경하지 않았습니다.

실제 화면은 gstack browse로 320·375·1440px 작성 화면과 교사 채팅의 위험도 설명을 확인했습니다. 기존 유의사항·개인정보·공통 UI·Tooltip 상호작용과 HTTP 잠금·자녀명 복원 테스트를 재사용해 검증합니다.

최종 검증은 공통 UI·작성·개인정보·Tooltip 회귀 78건, 교사 분석·검토 34건, 학부모 HTTP 100건으로 **212건 통과**했습니다. build·lint·앱/테스트 TypeScript·diff 검사도 통과했습니다. HTTP는 응답 interception 기반이며, 실제 서버 전송 테스트와 구분합니다.

## 안내 문구·문의 정보 간격·문장부호 줄바꿈 후속 개선

- 작성 안내를 `AI 분석 후 내용을 확인하고 전송할 수 있어요.`로 바꿨습니다. 분석 뒤 검토·전송하는 기존 동작을 긍정적인 표현으로 설명합니다.
- 문의 정보 카드는 기존의 프로필·제목/미리보기·메타 정보 3열 배치를 유지합니다. 사용자 후속 피드백에 따라 내용 폭 기준 배치와 미리보기 320px 제한을 되돌리고 열 간격만 16→12px, 메타 정보 내부 간격은 24→20px로 소폭 줄였습니다. 좁은 화면에서는 기존 세로 배치를 유지하며 그룹 간격은 16→12px로 줄이고 날짜는 카드 안에서 줄바꿈합니다.
- 학부모·교사 대화, 완충 요약, 학부모 문의 미리보기에 공통 `MessageText`를 사용합니다. 붙여 쓴 문장의 마침표·쉼표·물음표·느낌표 뒤에 선택적 줄바꿈 지점(`<wbr>`)을 추가합니다. 닫는 따옴표는 앞 문장과 함께 두며 숫자·소수·날짜·URL·이메일·영문 파일명은 보호합니다. 원문의 공백과 직접 입력한 줄바꿈, 저장·전송하는 문자열은 바꾸지 않습니다.
- 학부모 말풍선도 본문 16px와 1.6 행간, 어절 단위 줄바꿈으로 정리했습니다. 화면 폭에 따라 감싸며 문장부호마다 강제로 새 줄을 만들지는 않습니다.

문장부호·원문 보존·학부모/교사 대화 68건과 학부모 HTTP 100건으로 **168건 통과**했습니다. build·lint·앱/테스트 TypeScript·diff 검사도 통과했습니다. 이 검증 후 카드 간격은 위의 후속 피드백대로 조정했습니다.

`확인했어요.` 버튼이 비활성화된 동안에는 버튼 옆에 이유를 항상 표시합니다. 답변 전에는 `선생님 답변이 도착하면 확인할 수 있어요.`, 확인 후에는 `이 답변은 확인을 마쳤어요.`로 안내하며 활성화되면 안내를 숨깁니다. 모바일에서는 두 버튼 바로 위에 표시합니다. 보조 안내는 기존 14px/20px 토큰과 읽기 가능한 회색을 사용하고 `aria-describedby`로 버튼과 연결합니다. 답변 도착·확인 여부에 따른 기존 활성 조건은 유지합니다.

후속 변경은 학부모 문의 내역·추가 문의·교사 답변·확인 완료 흐름 30건으로 검증했습니다. build·lint·앱/테스트 TypeScript·diff 검사를 통과했으며 gstack browse에서 1440px의 버튼 옆 안내와 320px의 버튼 위 안내, 기존 카드 배치와 가로 넘침 없음을 확인했습니다.

대화의 날짜 구분선은 기존 데스크톱 20px·모바일 14px에서 본문과 같은 `--font-size-body`(16px)로 통일했습니다. 본문 크기와 긴 메시지의 1.6 행간은 유지하며, 날짜의 보조 정보 위계는 기존 배경과 가운데 정렬로 구분합니다.

사용자가 제시한 결석 문의 문장으로 gstack browse에서 320·375·1024·1440px의 날짜와 본문이 모두 16px이며 가로 넘침이 없음을 확인했습니다. 빌드와 diff 검사도 통과했습니다.

## 활성 모달 소유 포털의 배경 차단 예외 보완

CodeRabbit 후속 리뷰 중 이 항목은 앞선 반영에서 누락되어 있었습니다. `useModalFocus`가 모달 DOM을 포함하는 body 자식만 활성화했기 때문에, 모달과 동시에 렌더링되는 body 포털에도 `inert`가 적용됐습니다. 일반·업무 확인창 모두 데스크톱과 모바일에서 같은 문제를 재현했습니다.

- 공통 컨트롤의 기존 `aria-controls`·`aria-describedby` 연결을 따라 소유 포털과 그 안에서 열리는 툴팁을 식별합니다. 연결 없는 임의 포털을 자동으로 허용하지 않습니다.
- 모달이 열린 뒤 추가되는 포털과 접근성 연결 변경도 관찰합니다. 소유하지 않은 배경과 아래 모달의 포털은 계속 차단합니다. 연결된 설명이 배경 컨트롤과 부모를 공유해도 설명으로 이어지는 경로만 활성화합니다.
- 같은 소유 범위를 Tab 순환과 중첩 모달 종료 후 포커스 복원에 사용합니다. 마지막 모달을 닫으면 기존 inert·스크롤 상태를 복원하고 관찰자를 해제합니다.
- 학부모 전송 확인창이 열린 동안 발생한 실패 안내는 확인창 내부에 표시합니다. 배경 토스트를 예외로 허용하지 않아도 오류를 읽고 닫을 수 있으며, 재시도 시 이전 오류를 지웁니다. 확인창 밖의 안내는 기존 토스트를 유지합니다.

재현 테스트는 수정 전 4건 모두 `inert: true`로 실패했습니다. 소유 포털의 클릭, 동적으로 열리는 내부 툴팁, 중첩 모달의 차단·복원, 양방향 Tab, 기존·추가 배경의 차단과 최종 복원을 검증합니다.

전체 기본 회귀 540건 중 538건이 통과했고, 차단된 전송 오류 토스트로 실패한 2건은 위의 확인창 내부 안내로 보완했습니다. 이후 관련 UI·전송 검토 46건과 학부모 HTTP 100건을 재검증해 **146건 모두 통과**했습니다. 브라우저의 실제 접근성 트리에서도 소유 포털은 노출되고 배경 버튼은 제외됨을 확인했습니다. build·lint·앱/테스트 TypeScript·diff 검사도 통과했습니다.

## PR #76의 후속 CodeRabbit 리뷰 7건 반영

후속 브랜치에 있던 #72 리뷰 수정을 `feature/72-common-ui`에 별도로 반영했습니다. API 계약·위험 분석 상태 변경과 후속 화면 디자인 변경은 포함하지 않습니다.

| 리뷰 | 반영 내용 |
| --- | --- |
| 초안 생성 중 교사 목록 오류 | 잠금 중에도 목록 오류와 재시도 버튼을 표시하고 대상·제목 잠금은 유지합니다. |
| Popover 외부 포커스 | 외부 컨트롤로 이미 이동한 포커스를 트리거로 되돌리지 않습니다. |
| 포털 자손 Escape | 처리되지 않은 Escape는 Popover를 닫고 중첩 모달의 우선 처리는 유지합니다. |
| Tooltip 비활성화 | 열린 상태·닫기 타이머·터치 상태를 초기화합니다. |
| 터치 후 키보드 입력 | 두 번 터치한 뒤 Enter·Space로 다시 열 수 있습니다. |
| 모달 라디오 그룹 | 실제 Tab 정지점으로 양방향 순환합니다. |
| 모달 소유 포털 | 기존 aria-controls·aria-describedby 연결을 따라 소유 포털을 허용하고 배경과 아래 모달은 차단합니다. 동적 추가·Tab·포커스 복원·종료 시 상태 복원을 함께 처리합니다. |

배경 차단 중에도 전송 실패를 읽고 재시도할 수 있도록 확인창이 열린 동안 오류는 확인창 안에 표시합니다. 화면 밖의 안내는 기존 토스트를 유지합니다. 일반·업무 모달의 실제 접근성 트리에서도 소유 포털의 노출과 배경 버튼 제외를 검증합니다.

PR #76 브랜치 자체에서 build·lint·앱/테스트 TypeScript·diff 검사를 통과했습니다. 전체 기본 Playwright **494건**, 학부모 HTTP **32건**, 관리자 HTTP **12건**, HTTP 통합 **8건**으로 최종 검증 **546건 모두 통과**했습니다. 통합 첫 실행은 동의 화면 1건이 전체 30초 제한을 초과해 7건 통과·1건 실패였고, 코드 변경 없이 독립 실행(2 workers)에서 8건을 통과했습니다. 정확한 지연 원인은 미확정이며 결과에 중복 합산하지 않았습니다. HTTP는 응답 interception 기반입니다.

#78 브랜치에도 갱신된 #76을 병합해 중복 리뷰 수정 충돌을 최종 구현으로 정리했습니다. 병합 결과에서 공통 UI·전송 검토 46건과 학부모 HTTP 90건, build·lint·앱/테스트 TypeScript 검사를 통과했습니다.

## 대화 안내 크기 정렬과 약관 전문 모달 (2026-11-17)

- `parent-conversation-notice`는 작성 화면 아코디언 안내와 같은 본문 16px/24px·여백 16px·아이콘 간격 12px·기존 border/radius 토큰을 사용합니다. 기존 PC 20px·중간 폭 18px·모바일 15px 분기를 제거하고 아이콘은 20px로 맞췄습니다. 대화 메시지와 같은 글자 크기를 유지하며 안내는 계속 항상 보입니다.
- 사용자가 제공한 서비스 이용약관, 개인정보 수집·이용 동의서, 테스트 메시지 저장·활용 동의서를 문단·목록·표로 구성했습니다. 본문은 `src/features/policy/policyDocuments.ts`에서 관리합니다. 필수 여부·문의처·보유 기간 등의 미확정 표시는 원문대로 남겼습니다.
- 회원가입과 모든 역할의 마이페이지 동의 항목에서 전문을 열 수 있습니다. 메인 하단에서도 로그인 없이 3종을 열람합니다. 제공된 두 번째 문서는 개인정보 수집·이용 동의서이므로 개인정보처리방침으로 바꿔 표시하지 않습니다.
- 전문 링크 사이에는 화면낭독기에서 제외한 `|` 구분자를 표시합니다. 기본 색은 기존 회색 `#444444`이며 hover·키보드 focus 시 브랜드 파란색으로 표시합니다.
- 기존 Modal·Button·Badge를 재사용합니다. 본문만 스크롤하고 제목과 닫기 영역은 고정하며, 키보드 본문 스크롤·Tab 순환·Escape·닫은 뒤 원래 버튼 포커스 복귀를 지원합니다. 모바일은 화면 양끝 16px 여백을 유지합니다.
- 전문 보기 버튼은 체크박스 label 밖에 두고 기본 `type=button`을 유지합니다. 열람으로 동의·미저장 선택·회원가입 입력·저장된 정책 내역을 변경하지 않습니다. 서버의 requiredAgreed/optionalAgreed, policyVersion, 가입·동의 저장 조건은 유지합니다. 문서 시행일은 사용자가 제공한 2026. 11. 17로 표시합니다.

신규 모달 열람·인증·회원가입·메인·학부모 대화 114건과 기존 HTTP 통합 12건으로 **126건 통과**했습니다. build·lint·앱/테스트 TypeScript·diff 검사도 통과했습니다. gstack browse에서 1440px 약관, 320px 개인정보 동의서와 고정 닫기 영역, PC·모바일 대화 안내/본문 16px·여백 16px·가로 넘침 없음을 확인했습니다. HTTP 검증은 응답 interception 기반입니다.

## 미열람 표시와 재검토 요청 상세 아코디언

- 교사 대화의 읽음 표시 조건을 바로잡았습니다. 상대방이 읽지 않은 답변에만 `1`을 표시하고, 읽은 답변에는 시간만 남깁니다. 숫자와 함께 화면낭독기용 미열람 설명을 제공합니다.
- 서버의 기존 READ/readAt → readByParent 변환을 그대로 사용합니다. 로컬 교사·학부모 연결에서는 기존 parentAcknowledgedAt을 각 답변의 sentAt과 시간대까지 비교해 확인한 답변까지만 반영합니다. 이후 보낸 새 답변을 이전 확인 시각으로 읽음 처리하지 않습니다. 신규 읽음 API·전송 정책·상담 완료 조건을 추가하거나 바꾸지 않습니다.
- 최근 긴급 재검토 요청 상세의 native details/summary를 기존 Accordion으로 바꿨습니다. 요청한 `m2 2 6 6 6-6` 경로의 공통 ChevronDownIcon을 재사용하고 펼침 상태에 따라 회전합니다. 기본 접힘과 내용·로딩·오류 재시도를 유지하며 Enter·Space·aria-expanded/controls로 조작합니다.
- 안전 잠금·승인 대기·재검토 요청 행동은 아코디언 밖의 기존 영역에 유지합니다. 다른 관리자 공유·증빙 패널은 기존 표시를 따릅니다. 제목은 본문 16px, 최소 높이 56px이며 모바일의 내부 여백은 16px입니다. 상세 항목과 값은 PC 100px·모바일 88px의 라벨 열과 12px 간격으로 맞춰 읽기 쉽게 표시합니다.

교사 목록·답변·서버 변환·학부모 대화 110건과 HTTP 통합 14건으로 **124건 통과**했습니다. 실제 서버 읽음 응답의 변경, 이미 읽은 답변과 새 답변의 구분, 로컬 확인 시각의 시간대 비교와 갱신, 키보드 펼침·접힘 및 접어도 유지되는 안전 잠금을 검증했습니다. build·lint·앱/테스트 TypeScript·diff 검사도 통과했습니다. HTTP 검증은 응답 interception 기반이며 실시간 푸시나 신규 읽음 전송을 구현한 결과와 구분합니다.

## 공식 절차 열람 후 복귀와 판단 근거 빈 상태 간소화

- 공식 절차에서 뒤로가면 메시지 주소는 복원되지만 위험 요소 탭이 대화 탭으로 초기화되는 문제를 재현했습니다. 직접 history 상태를 덮어쓰던 이동을 React Router로 통일하고 원래 메시지·탭을 해당 history 항목에 저장합니다.
- 가이드의 뒤로가기와 브라우저 뒤로가기·앞으로가기를 지원합니다. 가이드에서 목록이나 다른 글을 열고 새로고침한 후에도 가이드 상단 뒤로가기로 처음 열었던 메시지의 위험 요소 탭에 복귀합니다. 답변 작성에서 연 경우에는 원래 작성 화면으로 돌아갑니다.
- 추가 판단 근거가 없을 때 큰 빈 상태 카드 대신 `추가 판단 근거가 제공되지 않았어요.`라는 14px/20px 안내만 표시합니다. 위쪽 8개 분류의 미확인·미탐지 구분은 유지하며, 추가 근거 없음 자체를 위험 없음으로 표시하지 않습니다.

교사 위험 분석·답변·목록·헤더 회귀 74건과 HTTP 통합 16건으로 **90건 통과**했습니다. 돌아온 메시지·활성 탭·답변 잠금, 가이드 내부 이동과 새로고침, 추가 근거 부재와 분류 상태를 검증했습니다. build·lint·앱/테스트 TypeScript·diff 검사도 통과했습니다. HTTP 검증은 응답 interception 기반입니다.

## 긴급 재검토 요청 통합과 승인 후 잠금 안내 갱신

- 위험도 검토에서 긴급 하향 시 기존 `확인 요청`을 `재검토 요청`으로 바꾸고 실제 Emergency 재검토 API 하나만 사용합니다. 로컬 상태·처리 기록만 바꾸던 아래쪽 버튼과 `riskReviewRequestedAt`은 제거했습니다. 일반 상향·하향 반영과 같은 점수의 검토 완료 동작은 유지합니다.
- 실제 접수 후 같은 버튼을 비활성화된 `검토자 확인 대기`로 표시합니다. 서버 접수 전 실패 시 입력을 유지하며 오류와 재시도를 제공하고, 요청 중에는 동기적인 중복 클릭도 막습니다. 최근 요청 조회로 새로고침 후 대기를 복원합니다. 검토 권한이 없으면 요청을 접수한 것처럼 표시하지 않습니다.
- 짧은 잠금 안내는 본문에 항상 표시합니다. 대기 중에는 `검토자가 확인하는 동안 답변 생성과 전송이 제한돼요.`를 사용하며 상세 절차는 기존 InformationTooltip에 둡니다. 안내 카드는 본문 16px·여백 16px와 기존 테두리·radius 토큰을 사용합니다. 모바일의 버튼과 44px 도움말은 같은 행 안에 들어가도록 폭을 나눕니다.
- 2026-11-17에 확인한 Swagger와 백엔드 `EmergencyReviewService.update`에 따라 긴급 하향 승인은 위험도 반영과 잠금 해제를 함께 처리합니다. 관리자 안내와 Mock 어댑터를 같은 계약으로 갱신했습니다. 화면은 서버가 반환한 `safetyLock`을 따르며 `APPLIED`만 보고 잠금을 해제하지 않습니다. 이전 승인 기록이 잠금을 명시적으로 유지하는 경우의 해제 동작은 남기며 반려·승인 대기 중에는 제공하지 않습니다.
- 빈 첫 공유 요약의 undefined → null/false 변화를 같은 값으로 정규화해 불필요한 재조회와 버튼의 일시적 재비활성화를 막습니다. 실제 요청 ID·결정·잠금 변경에는 기존 재조회를 유지합니다.

최종 교사·관리자·개인정보·답변 회귀 118건, HTTP 통합 18건, 관리자 HTTP 14건으로 **150건 통과**했습니다. 실제 요청 경로와 점수·사유, 실패 시 재시도, 동시 중복 클릭, 새로고침 후 대기 복원, 승인 응답의 잠금 해제, 잠금을 유지하는 이전 승인 응답, 권한 제한과 원문·답변 정책을 검증했습니다. 초기 조회 경합은 별도 반복 12건도 통과했으며 최종 건수에 중복 합산하지 않았습니다. build·lint·앱/테스트 TypeScript·diff 검사와 PC·320px 모바일의 버튼·도움말 배치를 확인했습니다. HTTP 검증은 명세 응답 interception 기반입니다.
