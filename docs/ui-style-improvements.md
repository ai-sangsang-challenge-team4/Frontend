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

## 검증 결과

최종 실행 결과는 PR 본문 및 아래 표에 기록한다. HTTP 테스트는 실제 HTTP 어댑터와 가로챈 응답을 사용하며, 실서버 검증과 구분한다.

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

## 수정 파일 목록

- `README.md`
- `docs/ui-style-improvements.md`
- `src/App.css`
- `src/features/admin/AdminPages.css`
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
- `src/features/parent-message/ParentMessageHistory.css`
- `src/features/parent-message/ParentMessageReview.css`
- `src/index.css`
- `src/layouts/AdminLayout.tsx`
- `src/layouts/ParentLayout.tsx`
- `src/layouts/TeacherLayout.tsx`
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
- `tests/auth/common-ui.spec.ts`
- `tests/auth/parent-message-history.spec.ts`
- `tests/auth/ui-layout.spec.ts`
- `tests/fixtures/common-ui.html`
- `tests/fixtures/common-ui.tsx`
- `tsconfig.playwright.json`
