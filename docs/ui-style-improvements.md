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

약관 전문을 여는 실제 URL·본문은 현재 코드와 동의 API에 없다. 동작하지 않는 `보기` 링크나 새로운 약관 본문을 만들지 않았으며, 전문 연결은 해당 원문·경로가 제공된 뒤 진행할 후속 항목이다.

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
