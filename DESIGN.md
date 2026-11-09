# 티처허브 Design System

교사가 학부모 메시지를 읽고, AI의 분석 근거를 확인하고, 필요한 사람의 검토를 거쳐 대응하는 업무 도구의 디자인 기준입니다. 교사·관리자·학부모 화면에서 같은 시각 언어를 사용하되, 역할별 권한과 작업은 구분합니다.

기준: [Issue #71](https://github.com/ai-sangsang-challenge-team4/Frontend/issues/71), 2026-11-09의 로컬 코드 `c616cd4`. 이 문서는 코드 분석에 기반한 후속 구현 가이드입니다. 현재 화면이 모든 규칙을 충족한다는 뜻은 아닙니다. 이번 작업에서는 CSS·TSX·기능·API를 변경하지 않습니다.

## 문서 사용법과 근거

값의 출처를 다음과 같이 표시합니다. **토큰 이름이 제안된 것과 값 자체가 새로 생긴 것을 구분**합니다.

| 표기 | 의미 | 구현 시 처리 |
| --- | --- | --- |
| **기존 토큰** | CSS에 선언된 이름과 값 | 우선 재사용 |
| **기존 리터럴** | 실제 CSS에 있으나 토큰이 아닌 값 | 사용 위치를 확인한 뒤 의미별 토큰으로 정리 |
| **제안·재사용** | 기존 값을 다른 역할에 연결하거나 토큰화 | 아직 구현되지 않은 별칭·사용 규칙 |
| **제안·신규** | 코드에 없는 값·동작·컴포넌트 | 후속 이슈에서 구현·검증 |

아래의 규칙과 예시는 후속 구현의 목표입니다. 기존 정책을 설명한 부분은 현행 동작을 유지해야 할 제약입니다. 정책·권한·서버 허용 상태와 표현 가이드가 충돌하면 현행 동작을 보존하고 충돌을 이슈로 남깁니다. 이 문서로 위험도 경계, 원문 열람 권한, 전송 조건, 관리자 공유 범위, 잠금 해제를 변경하지 않습니다.

### 기존 프로젝트 분석

| 영역 | 실제 구현과 관찰 | 유지·개선 방향 |
| --- | --- | --- |
| 스타일 기반 | [teacher-prototype.css](src/shared/styles/teacher-prototype.css)에 전역 reset, 색·간격·폰트 크기 토큰, `.ui-*`, `.app-layout`, 이전 메시지 스타일이 함께 존재 | 기존 토큰을 기준점으로 삼고, 향후 기반 토큰·공통 UI·화면 스타일의 책임을 정리 |
| 전역 스타일 | [index.css](src/index.css)는 `:root`에 `#121826`·`#f7f8fb`·Inter를 선언. [App.css](src/App.css)에는 공개·인증·랜딩 스타일과 이전 `.role-layout` 등이 존재 | 전역 선언과 실제 역할별 shell을 구분. 이름만 보고 이전 `.role-layout`의 240px을 현행 사이드바 기준으로 사용하지 않음 |
| 폰트 | 공통 CSS에서 Pretendard variable을 불러오며 `.app-layout`, `.board-inbox-page`, `.sidebar-shell`, `.auth-screen`이 Pretendard를 직접 지정. `body`의 `--font-family-base`는 선언이 없음 | Pretendard 기반을 유지하고 미정의 변수·중복 폰트 스택을 후속 정리 |
| 공통 UI | [shared/components/ui](src/shared/components/ui)에 Button, ButtonLink, Badge, StatusChip, TextField, TextareaField, Select, Dropdown, Modal, Tooltip, Popover, Accordion, Tabs, Toast, EmptyState | 기존 API와 키보드 동작 재사용. 공통 Card·SidePanel 컴포넌트는 현재 없음 |
| 교사 화면 | [TeacherMessages.tsx](src/features/message/TeacherMessages.tsx)가 목록·상세·답변 작성 상태를 관리. 실제 router는 세 메시지 경로 모두 `MessageListPage`로 연결 | 상태·라우팅 구조를 확인하고 구현. 별도 상세 페이지 파일이 있다는 이유로 사용 중이라고 가정하지 않음 |
| 교사 CSS | [TeacherMessages.css](src/features/message/TeacherMessages.css)가 `messages/MessagesPage.*.css`를 base → shared → list → detail → conversation → risk → modals → templates → escalation → responsive 순으로 import | `.board-*`의 공통 UI 덮어쓰기를 함께 확인해야 최종 스타일을 알 수 있음 |
| 역할별 shell | 교사 홈은 `AppLayout`, 메시지함·관리자는 `.board-inbox-page`, 학부모는 `ParentLayout`과 공통 Sidebar 사용 | 297px/100px 사이드바와 1188px 콘텐츠 폭을 공통 출발점으로 유지 |
| 학부모 | `ParentMessageComposer.css`, `ParentMessageReview.css`, `ParentMessageHistory.css`가 공통 field·tab을 재정의. 작성 화면 label 24px, control 20px, CTA 최소 67px 등 큰 규격 사용 | 읽기 쉬운 큰 글씨는 유지 가능. 업무 밀도 차이를 명시하고 작은 화면에서 무조건 축소하지 않음 |
| 관리자 | [AdminPages.css](src/features/admin/AdminPages.css)는 `.board-*`를 재사용하고 처리 단계·메모·이력 차이만 추가 | shell·위험 표현을 교사와 공유. 관리자 작업명과 권한은 별도로 유지 |
| 안전·오류 UI | `AiJudgmentNotice`, `PrivacyMaskingNotice`, `AnalysisStateNotice`, `AsyncContent`가 참고 정보·실패·재시도를 표시 | 이를 재사용해 정상·대기·실패·권한 없음·데이터 없음 상태를 구분 |

### 레퍼런스 분석 및 적용 범위

[VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md)의 각 문서는 `colors`, `typography`, `spacing`, `rounded`, `components` 등의 값과 Overview·Layout·Do's and Don'ts·Responsive·Known Gaps를 함께 기술합니다. 티처허브도 **값 → 역할 → 컴포넌트 → 예외·검증** 순서로 설명합니다. 외부 도구용 YAML 스키마나 lint 호환성을 보장하는 파일은 아닙니다.

이 자료들은 각 서비스의 공식 전체 제품 명세가 아니라 외부에서 관찰한 디자인 분석이며, 주로 마케팅 화면을 다룹니다. 특히 Claude 문서는 실제 `claude.ai` 대화 UI를 범위 밖으로 명시하고, IBM은 제품 데이터 테이블 등의 분석이 빠져 있음을 밝힙니다. 아래의 메시지함·사이드 패널 적용은 이 관찰을 바탕으로 한 **티처허브의 설계 판단**이며 원문에 그 동작 명세가 있다고 주장하지 않습니다.

| 레퍼런스 | 확인한 요소 | 티처허브에 적용할 요소와 이유 | 적용하지 않을 요소와 이유 |
| --- | --- | --- | --- |
| [Notion DESIGN.md](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/notion/DESIGN.md) | 4px 기반 간격, 제목·본문 계층, 선·면으로 구분하는 카드, 탭·Accordion. 문서는 hero·pricing 중심 | 정보를 제목 → 요약 → 세부 근거로 펼침. 보조 정보를 패널에 두어 현재 메시지 맥락 유지. 교사의 반복 탐색 비용을 줄이기 위한 응용 | 보라 CTA, navy hero, 여러 pastel feature 면, 장식 일러스트는 브랜드·업무 화면에 부적합. 원문 내 pill/직사각형 설명의 상충을 그대로 가져오지 않음 |
| [IBM DESIGN.md](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/ibm/DESIGN.md) | Carbon을 참고한 제한된 강조색, 4px 정렬, 1px 경계, 일관된 입력·탭 | 관리자 목록·이력의 열 정렬, 일정한 label 위치, 숫자·시간 비교, 같은 상태의 같은 표현. 데이터 가독성과 예측 가능성을 확보 | IBM Blue·Plex·0px 모서리·16열 grid의 전면 도입은 기존 정체성과 충돌. 마케팅 문서를 완성된 엔터프라이즈 대시보드 명세로 취급하지 않음 |
| [Intercom DESIGN.md](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/intercom/DESIGN.md) | 조용한 chrome, 흰 카드와 바탕의 구분, 절제된 색, helpdesk/inbox 제품 mockup. 제품 UI 상태는 별도 범위 | 목록 → 대화 → 답변 작업의 흐름, 발신자·수신 시각·작업 상태의 고정된 위치, 답변 중 근거 확인. 상담 맥락을 유지하기 위한 응용 | cream 바탕·Fin Orange·Saans·홍보용 대형 여백은 도입하지 않음. AI 자동 처리·자동 종료를 시각 패턴과 함께 가져오지 않음 |
| [Claude DESIGN.md](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/claude/DESIGN.md) | 부담을 낮추는 분위기, 절제된 장식, 8px control·12px card의 계층, 읽기 쉬운 본문 | 친근한 안내 문장, 생성 중·초안·사람 검토 상태의 분명한 구분, 충분한 본문 행간. AI를 이해 가능한 보조자로 표현 | coral·cream·serif·전용 서체·dark code window는 복제하지 않음. 원문의 hover 문서화 생략 규칙도 채택하지 않음. 티처허브에는 hover·focus·실패 상태 명세가 필요 |

## 1. Design Philosophy & Visual Direction

**방향: 차분한 업무 공간, 확인 가능한 AI 근거, 사람이 책임지는 결정.** 흰색·옅은 회색을 바탕으로 기존 블루를 행동에, 노랑·빨강을 위험 신호에 제한해 사용합니다. 시각적 친근함은 둥근 모서리와 명확한 한국어 안내로 만듭니다.

1. **내용이 먼저 보인다.** 제목, 발신자, 최근 수신, 현재 처리 상태를 먼저 읽을 수 있어야 합니다. 요약·판단 이유는 좌측 정렬하고 장식보다 정보 간 구분에 공간을 씁니다.
2. **AI 결과에는 출처가 보인다.** `AI 위험 분석`, `AI 완충 요약`, `AI 답변 초안`을 명시합니다. `교사 검토`, `관리자 결정`, `현재 적용 위험도`와 같은 label 체계를 사용합니다.
3. **색상과 업무 의미를 분리한다.** 블루는 행동·탐색·정보, 위험 배지는 위험 단계, 처리 chip은 업무 상태를 뜻합니다. 블루 배지만으로 “안전 판정”이나 “AI 확정”을 표현하지 않습니다.
4. **상세 정보는 필요할 때 펼친다.** 위험 요소별 이유·근거는 Accordion, 긴 원문·규정은 보조 패널을 우선 검토합니다. 잠금 사유와 긴급 절차는 항상 본문에서 확인할 수 있어야 합니다.
5. **최종 행동의 주체를 드러낸다.** `AI 초안 생성`, `위험도 검토 저장`, `관리자에게 공유`, `최종 전송`처럼 대상과 결과를 말합니다. 한 화면·작업 영역의 강조 CTA는 하나를 원칙으로 합니다.

앱 본문에 홍보용 hero, 큰 일러스트, gradient CTA, 위험 단계와 무관한 다색 카드를 추가하지 않습니다. 랜딩 화면의 표현은 별도 목적을 인정하되, 업무 화면에 그대로 적용하지 않습니다. 현재는 light 화면이 기준이며 검증되지 않은 dark palette를 제공하지 않습니다.

## 2. Color Palette & Semantic Tokens

### 2.1 기존 색상 기준

다음은 모두 `teacher-prototype.css`의 **기존 토큰**입니다. 이름을 바꾸기보다 역할에 맞는 토큰을 재사용합니다.

| 역할 | 토큰 | 실제 값·연결 | 사용 규칙 |
| --- | --- | --- | --- |
| 브랜드 | `--color-primary` | `#3b5bdb` | 주요 CTA, 링크, 선택 강조 |
| 브랜드 상태 | `--color-primary-hover` / `--color-primary-active` | `#314fca` / `#2c46b2` | hover / 누르는 동안 |
| 브랜드 보조 면 | `--color-blue-30` / `--color-primary-subtle` | `#ebeffb` / blue-30 별칭 | 선택·정보·대화 영역 바탕 |
| 기본 면 | `--color-bg-surface` / `--color-bg-canvas` | `#ffffff` / `#f8f8f8` | 카드·입력 / 구분용 바탕. 현재 shell 자체는 흰색인 경우가 많음 |
| 비활성 면 | `--color-bg-disabled` | `#eef0f5` | 사용 불가 입력 바탕 |
| 본문 | `--color-black` / `--color-text-primary` | `#1c1a1a` / black 별칭 | 제목·본문·핵심 label |
| 보조 본문 | `--color-text-secondary` | `#444444` | 설명·내용·표 메타 |
| 약한 본문 | `--color-text-muted` / `--color-text-disabled` | `#888888` / `#8b93a7` | 기존 값. 작은 필수 텍스트에 사용할 때 대비 개선 필요 |
| 반전·브랜드 글자 | `--color-text-inverse` / `--color-text-brand` | surface / primary 별칭 | 진한 면의 글자 / 링크·정보 |
| 경계 | `--color-border-default` / `--color-border-divider` / `--color-border-strong` | `#a2a2a2` / `#e7e7e7` / `#3a3a3a` | control 경계 / 장식 구분선 / 강한 선택선 |
| 아이콘·focus | `--color-bg-icon` / `--color-border-focus` | `#333f49` / primary 별칭 | 의미 있는 단색 아이콘 / focus 경계 |
| 위험 | `--color-danger` / `--color-text-danger` | `#fd2d27` / danger 별칭 | 기존 긴급 면·오류. 작은 글자 대비는 2.3 참고 |
| 위험 보조 면 | `--color-danger-subtle` | `#ffecef` | 위험·오류 알림 바탕 |
| 핑크 | `--color-pink-3` / `--color-secondary-pink` | `#ff4b6c` / pink-3 별칭 | 기존 분석·완충 요약 강조. AI의 확정 판단이나 검토 완료를 뜻하지 않음 |
| 주의·중요 | `--color-secondary-yellow-subtle` / `--color-yellow-2` | `#fff5cf` / `#f5b700` | 주의 면 / 즐겨찾기·기존 주의 경계 |

`--color-blue-70`, `--color-text-brand`는 primary 별칭이고 `--color-bg-surface-dark`는 black 별칭입니다. 같은 역할의 별도 hex를 새로 만들지 않습니다.

### 2.2 코드에 존재하는 변형과 정리 기준

| 기존 리터럴·위치 | 기존 토큰과의 차이 | 제안·재사용 |
| --- | --- | --- |
| `.board-risk-attention`의 `#fff180` | 공통 warning 면은 `#fff5cf` | 위험 단계 면은 공통 warning 값으로 통일. `#fff180`은 원문 하이라이트에 한정 |
| `.board-risk-danger`의 `#fee9eb` | 공통 danger 면은 `#ffecef` | 의미가 같은 위험 면은 공통 danger-subtle 사용 |
| `.board-risk-normal`의 회색 면·검정 글자 | `riskVariant.normal`은 `info`라 공통 Badge만 쓰면 블루 계열 | 위험 Low는 회색을 기준으로 유지하고 정보 Badge와 분리 |
| `.ui-button--danger:hover`의 `#d9231f` | 아직 별도 토큰 없음 | 흰 글자가 있는 진한 위험 면에 재사용 가능 |
| index/prototype `:root`의 다른 바탕·글자 값 | 토큰과 전역 직접 선언이 공존 | 역할별 실제 적용을 확인하고 기반 선언을 정리. 색을 일괄 치환하지 않음 |

위 통일은 **후속 변경 제안**이며 현재 CSS는 그대로 둡니다. 4단계 위험의 의미·판정은 11.3의 현행 매핑을 유지합니다.

### 2.3 접근성 보완을 위한 제안 토큰

브랜드 primary와 기존 면은 유지합니다. 아래 이름은 **아직 CSS에 선언되어 있지 않습니다**.

| 제안 이름 | 값 | 출처·목적 |
| --- | --- | --- |
| `--color-text-muted-readable` | `#666666` | **제안·신규 값**. 흰색·canvas 위 작은 메타·도움말 가독성 개선 |
| `--color-text-danger-readable` | `#b91c1c` | **제안·신규 값**. 흰색·danger-subtle 위 오류·위험 글자 |
| `--color-danger-strong` | `#d9231f` | **제안·재사용**. 기존 danger hover 리터럴을 토큰화. 흰 글자의 긴급 배지·danger 버튼 기본 면 후보 |
| `--color-border-control` | `var(--color-text-muted)` = `#888888` | **제안·재사용**. 흰 면에서 식별 경계가 필요한 control용. 장식 divider는 기존 값 유지 |
| `--color-highlight` | `#fff180` | **제안·재사용**. 기존 원문 근거 강조 면. 선택·focus는 별도 표시 |

예시: 후속 이슈에서 도입할 위험 표시용 별칭입니다. 이 코드 블록은 적용 완료된 CSS가 아닙니다.

```css
/* 제안: 위 신규 토큰을 먼저 선언한 후 연결한다. */
:root {
  --risk-low-bg: var(--color-bg-canvas);
  --risk-low-fg: var(--color-text-primary);
  --risk-medium-bg: var(--color-secondary-yellow-subtle);
  --risk-medium-fg: var(--color-text-primary);
  --risk-high-bg: var(--color-danger-subtle);
  --risk-high-fg: var(--color-text-danger-readable);
  --risk-emergency-bg: var(--color-danger-strong);
  --risk-emergency-fg: var(--color-text-inverse);
}
```

AI·사람의 구분은 색 대신 **명시적인 label·아이콘·문장·영역**으로 해결합니다. 별도의 “AI 보라색”이나 성공 녹색 palette를 추가하지 않습니다. 현재 `Badge success`·상담 완료는 블루를 사용하므로, 완료의 의미는 텍스트와 함께 전달합니다.

## 3. Typography

**기본 서체: 기존 Pretendard variable 유지.** 현재 외부 CDN `@import`를 사용합니다. 새 유료 서체나 영문 전용 display 서체는 추가하지 않습니다. 공통 `--font-family-base` 정의는 **제안·재사용**으로 다음 기존 스택을 사용합니다: `Pretendard, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. 폰트 로딩 실패 시에도 한국어가 잘리지 않아야 합니다. self-host 전환은 별도 성능·배포 이슈로 다룹니다.

| 용도 | 크기·행간·굵기 | 출처와 규칙 |
| --- | --- | --- |
| 페이지 제목 | 28px / 36px / 700 | **기존 리터럴**, `.teacher-app-header h1`, `.board-page-title`. 모바일은 **제안** 24px / 32px로 축소 가능 |
| 섹션 제목 | 20px / 26~28px / 700 | `--font-size-title-sm:20px`, `--line-height-title-sm:1.3`, `--font-weight-semibold:700` **기존 토큰**. 화면의 600은 현행 변형 |
| 본문·입력·기본 버튼 | 16px / 24px / 400, label 500 | `--font-size-body`, `--line-height-body`, regular·medium **기존 토큰** |
| 긴 메시지·AI 근거 | 16~18px / 1.5~1.6 / 400 | **제안·재사용**. 기존 본문·안내 값 활용. 현재 대화 말풍선 20px/24px는 행간 개선 대상 |
| 보조 정보·도움말 | 14px / 20~22px / 400~500 | **기존 리터럴을 표준 역할로 채택하는 제안**. 일반 본문을 이 크기로 낮추지 않음 |
| caption·개수 | 12px / 1.35 / 500 | `--font-size-caption`, `--line-height-caption` **기존 토큰**. 숫자 count 등 짧은 정보에 한정 |

`--font-weight-semibold`는 이름과 달리 **700**입니다. 이름만 보고 600으로 변경하면 안 됩니다. `--font-weight-bold`도 일부 avatar에서 참조되지만 정의가 없습니다. 후속 정리 시 기존 token 값은 보존하고 600 역할의 필요 여부를 별도로 결정합니다.

제목 한 단계 차이는 크기·굵기·간격 중 최소 하나로 드러냅니다. 긴 본문은 좌측 정렬, `white-space: pre-wrap`, `word-break: keep-all`, `overflow-wrap: anywhere` 조합을 검토합니다. 목록 미리보기만 1~2줄로 제한하고, 상세 원문·판단 근거·결정 사유는 생략하지 않습니다. 숫자 비교 영역에는 **제안** `font-variant-numeric: tabular-nums`를 사용하고 시간 표기를 열 단위로 정렬합니다.

## 4. Spacing & Layout

### 4.1 간격

기본 단위는 **기존 4px**입니다. 새 spacing scale을 병행하지 않습니다.

| 기존 토큰 | 값 | 기본 용도 |
| --- | --- | --- |
| `--space-1` / `--space-2` | 4 / 8px | count 내부, 아이콘과 짧은 label |
| `--space-3` / `--space-4` | 12 / 16px | control 간격, field label·helper 그룹 |
| `--space-5` / `--space-6` | 20 / 24px | 카드 내부, 관련 항목 간격 |
| `--space-8` / `--space-12` | 32 / 48px | 섹션·작업 영역 사이 |
| `--space-3-5` / `--space-4-5` | 14 / 18px | 기존 field·Dropdown의 보정값. 일반 섹션 간격으로 확장하지 않음 |

후속 구현 기본값은 카드 padding 24px, 카드 내부 gap 16px, 섹션 간 32px, 큰 작업 영역 간 48px입니다. 모바일 카드 padding은 16~20px로 줄입니다. 33px toolbar margin, 21px nav gap, 58px form 간격 등 기존 리터럴은 관찰값이며 새로운 공통 토큰으로 승격하지 않습니다. 정렬·광학 보정이 필요할 때만 이유를 남깁니다.

### 4.2 shell과 콘텐츠

| 항목 | 기존 값·위치 | 기준 |
| --- | --- | --- |
| 사이드바 | 297px, 축소 rail 100px | `TeacherSidebar.css`, `.app-layout`, `.board-inbox-page` 유지 |
| 일반 콘텐츠 | 최대 1188px | `--app-content-max`, `--board-content-max` 재사용 |
| 교사 상세 | 최대 1053px | `.board-detail` 유지. 긴 본문은 내부 줄 길이 별도 관리 |
| 학부모 | 목록 984px, 상세 1043px, 후속 작성 1053px | `ParentLayout.css`의 목적별 폭. 통일이 필요한지는 후속 검토 |
| 큰 화면 여백 | 위 88px, 왼쪽 100px, 오른쪽 56px | 현행 값. board 축소 시 왼쪽 72px, AppLayout 축소 시 100px로 서로 다름 |
| 작은 화면 여백 | 980px 이하: 48px 24px 72px, 620px 이하: 36px 16px 56px | 메시지·공통 shell의 현행 규칙 |

후속 shell 정리에서는 콘텐츠 시작선과 제목 위치를 우선 맞춥니다. 위 숫자를 새 12열 grid로 치환하지 않습니다. `minmax(0, 1fr)`, 자식의 `min-width:0`을 유지해 긴 이름·메시지가 폭을 밀지 않게 합니다. 본문은 **제안** 최대 약 65ch로 제한하되 한국어 실제 줄 길이를 확인합니다. 목록·메타는 사용 가능한 전체 폭을 씁니다.

목록·상세·답변은 한 작업의 연결된 상태입니다. 보조 패널 때문에 필수 정보를 읽을 공간이 부족해지면 한 열로 전환합니다. `.board-inbox-page`의 기존 `min-height:1015px` 같은 화면 고정 높이는 데이터 양·작은 창에서 불필요한 스크롤을 만들 수 있어 후속 검토합니다.

## 5. Border Radius & Shadow

| 역할 | 값 | 출처·규칙 |
| --- | --- | --- |
| 작은 항목 | `--radius-xs:6px` | **기존 토큰**, Dropdown 항목·작은 닫기 영역 |
| 기본 control·badge·카드 | `--radius-sm:8px` | **기존 토큰**, Button·field·Badge·Modal의 현재 기본 |
| 큰 내용 패널 | 12px | **기존 리터럴**, risk·compose·확인 dialog. **제안·재사용** `--radius-panel:12px`로 토큰화 |
| 대화 말풍선 | 16px, 한쪽 아래 모서리 0 | **기존 리터럴**. 발신 방향을 보조하며 발신자 label을 대체하지 않음 |
| 대화 큰 면 | 20px | **기존 리터럴**, `.board-conversation`. 일반 카드에 확장하지 않음 |
| 원형·pill | `--radius-full:999px`, avatar 50% | **기존 값**. avatar·count·날짜 등 명시된 용도만 사용 |

깊이는 먼저 면·구분선으로 표현합니다. 표·목록의 모든 행에 그림자를 넣지 않습니다. 기존 카드·Sidebar에서 사용 중인 `--shadow-sm:0 0 10px rgb(0 0 0 / 10%)`는 재사용하되, 중첩 카드마다 반복하는 것은 줄입니다.

기존 `--shadow-focus:0 0 0 3px rgb(59 91 219 / 18%)`는 focus 보조 효과입니다. 명확한 2px outline·border와 함께 사용합니다. Modal의 `0 18px 48px rgb(17 17 17 / 18%)`, Toast의 `0 8px 28px rgb(17 17 17 / 16%)`도 **기존 리터럴**입니다. **제안·재사용**으로 `--shadow-dialog`, `--shadow-toast`에 역할을 부여하고 새 효과를 늘리지 않습니다.

공통 Modal은 8px·흰색·진한 그림자, BoardConfirmDialog는 12px·canvas·shadow-sm으로 다릅니다. 통합은 후속 이슈에서 접근성·내용 길이를 함께 확인하고 수행합니다.

## 6. Component Guidelines

### Button과 행동

기존 `Button`의 `variant="primary|secondary|outline|ghost|danger"`, `size="sm|md|lg"`, `isLoading`, `leftIcon`, `fullWidth`를 사용합니다. 이동은 `ButtonLink`·링크, 화면 안 작업은 button으로 구분합니다.

| 크기 | 기존 최소 높이·글자 | 사용 |
| --- | --- | --- |
| sm | 34px / 15px | 보조 작업. 터치 화면에서는 hit area 44px 이상으로 보완하는 **제안** |
| md | 47px / 16px | 기본 저장·검토·전송 |
| lg | 52px / 20px | 큰 화면의 주요 진입. 모든 CTA를 이 크기로 키우지 않음 |

primary는 현재 작업의 다음 행동 하나, outline은 취소·임시저장·보조 행동, ghost는 도구 행동에 사용합니다. danger는 위험을 뜻하는 데이터 배지가 아니라 삭제 등 결과가 손실을 일으키는 행동에 씁니다. `안전 잠금 해제`는 경고 설명과 확인을 동반하되 무조건 빨간 CTA로 만들지 않습니다. `isLoading`은 기존처럼 버튼을 비활성화하고 `aria-busy`를 제공합니다.

### Card·목록·Badge

공통 Card는 없습니다. 현재 `MessageContextCard`, `.board-risk-workflow-panel`, `.board-parent-card`를 먼저 검토합니다. 새 공통화는 header(제목·출처), body(내용), footer(행동)의 슬롯이 필요한 경우에만 후속 이슈에서 합니다. 모든 카드를 클릭 가능하게 만들지 않습니다.

목록 행은 제목·상대방·학급·최근 내용·시간·업무 상태를 일정한 순서로 읽게 합니다. 행 열기와 별표 버튼은 독립 hit area로 유지하고 button 안에 button을 넣지 않습니다. 긴 제목은 미리보기에서 생략할 수 있지만 접근 가능한 이름과 상세 화면에서 전체를 제공합니다.

`Badge`는 분류 정보, `StatusChip`은 상담·검토의 업무 상태에 사용합니다. Badge에는 현재 `neutral|brand|info|success|warning|danger|critical`이 있습니다. 위험은 **기존 `RiskBadge`와 매핑을 재사용**하고 페이지에서 새 등급명·색을 만들지 않습니다. badge 자체는 버튼이 아닙니다. 긴 상태 label에 기존 73px/83px 고정 폭을 강제하지 말고 내용 폭·줄바꿈을 허용하는 것이 후속 기준입니다.

### Input·Select·Dropdown

`TextField`, `TextareaField`, `Select`의 label·helperText·error·고유 id·`aria-describedby`·`aria-invalid` 연결을 재사용합니다. placeholder는 label을 대체하지 않습니다. 필수 항목은 “필수” 텍스트 또는 설명과 함께 전달하고 오류는 입력 아래에 원인과 수정 방법을 표시합니다.

field의 기존 sm/md/lg shell 높이는 37/47/52px입니다. 기본은 md, 여러 줄 입력은 기본 116px 이상과 세로 resize를 유지합니다. 글자 제한은 기존 API·기능의 값에 따릅니다. 디자인 목적으로 제한을 바꾸지 않습니다.

간단한 값 선택은 native `Select`를 우선합니다. 설명이 필요한 기존 필터에는 `Dropdown`을 재사용하되 현재 구현은 방향키 이동·선택 후 focus 복귀가 충분하지 않아 보완이 필요합니다. 새 listbox를 중복 구현하지 않습니다. 부모 selector가 공통 오류색·focus를 덮지 않는지 확인합니다.

### Modal·Popover·Tooltip·Tabs

`Modal`의 기존 폭은 sm 400 / md 520 / lg 720px, 화면 안 max-height와 내부 스크롤입니다. 제목, 닫기, 필요한 footer를 제공합니다. 원문 열람 확인·최종 전송·잠금 해제처럼 결정을 잠시 멈춰야 하는 작업에 사용합니다. 긴 설명의 기본 저장소로 사용하지 않습니다.

기존 `Modal`에는 dialog label, Escape, Tab 순환, 초기 dialog focus, 닫은 뒤 focus 복귀, body scroll lock이 있습니다. `BoardConfirmDialog`는 Escape·scroll lock만 구현되어 있어 같은 수준의 focus 처리가 필요합니다. 모양을 유지하면서 공통 Modal 동작을 재사용하는 방향을 우선합니다.

Popover는 클릭으로 여는 짧은 보조 설명·링크, Tooltip은 짧은 용어·아이콘 설명에 사용합니다. 현재 Tooltip은 별도 파일에 있지만 UI barrel에서 export하지 않습니다. 직접 import 가능 여부와 접근성 보완을 확인합니다. 상세 기준은 11.6에 있습니다.

동등한 정보 전환은 `Tabs`, 개별 세부 정보는 `Accordion`을 사용합니다. 공통 Tabs의 방향키·Home·End·roving focus를 유지합니다. 현재 메시지 상세의 수동 nav button은 공통 Tabs와 다르므로 탭 역할·선택 상태를 후속 정리합니다. 단계가 있는 승인 절차를 단순 탭으로 표현하지 않습니다.

### Loading·Empty·Error·Toast

기존 `AsyncContent`, `LoadingState`, `ApiErrorFallback`, `EmptyState`, `AnalysisStateNotice`를 먼저 사용합니다. 목록 0건, 검색 결과 0건, 분석 미제공, 로딩, 실패, 권한 없음은 서로 다른 문구와 다음 행동을 제공합니다. 실패한 조회를 “없음”으로 표시하지 않습니다.

Toast는 임시저장 등 보조 알림에 제한합니다. 현재 Toast는 5초 뒤 닫히고 모든 메시지를 `role="alert"`로 읽습니다. **제안**: 성공·진행은 `status`/polite, 즉시 수정이 필요한 오류는 alert로 나누고, 전송 실패·잠금·승인 결과는 화면 본문에도 지속해서 남깁니다. 중요한 결과를 자동 소멸 알림으로만 전달하지 않습니다.

## 7. Interaction & Hover States

| 상태 | 기준·예시 | 현재와 후속 차이 |
| --- | --- | --- |
| Default | 흰 면·기본 글자·식별 가능한 control 경계 | 기존 공통 UI 재사용 |
| Hover | primary `#314fca`, outline·ghost·목록은 canvas 면 | 기존 값 유지. 공통 secondary는 기본/hover가 같은 `#ebeffb`이므로 경계 등 추가 신호를 후속 검토 |
| Focus-visible | 기존 `2px solid var(--color-border-focus)`, offset 2px. field는 focus 경계와 shadow-focus | hover와 별개로 항상 보임. `outline:0` 적용부는 동등한 focus 표현을 반드시 확인 |
| Active/pressed | primary `#2c46b2`, 누르는 순간만 표시 | 위험 데이터·선택 상태를 바꾸지 않음. 다른 variant의 pressed도 후속 명세·검증 |
| Selected/current | 탭은 2px 하단선·선택 의미, nav는 현재 위치, 즐겨찾기는 `aria-pressed` 등 의미와 함께 | hover와 선택이 같은 면이어도 label·선·상태 속성으로 구별 |
| Disabled | 기존 opacity 0.5·disabled 면·cursor. 인접 본문에서 이유 제공 | 위험도·잠금 안내 문장까지 흐리게 만들지 않음 |
| Loading | 원래 작업 대상 유지, spinner·“전송 중…”·중복 요청 방지 | `AI 초안 생성 중`과 `최종 전송 중`을 다른 문구로 구별 |
| Error | 입력·작업 영역에 원인·재시도, 작성 내용 유지 | 서버 성공 전에 “저장됨/공유됨/해제됨”으로 바꾸지 않음 |

transition은 필요한 속성에만 적용합니다. field의 **기존 160ms**, Tooltip의 **기존 140ms**, shell의 **기존 180~200ms**를 재사용하고 업무 카드에 새로운 입장 효과를 붙이지 않습니다. hover로 위치·크기가 움직여 클릭 지점이 바뀌면 안 됩니다.

**제안·신규 공통 동작**: `prefers-reduced-motion: reduce`에서 shell·Tooltip 전환과 장식 animation을 줄이거나 제거합니다. 현재 랜딩·일부 로딩에는 처리가 있지만 `.ui-button-spinner`와 공통 shell까지 일관되게 적용되어 있지는 않습니다. 로딩 텍스트는 animation 중지 후에도 남깁니다.

## 8. Responsive Design

새 breakpoint 체계를 병행하지 않고 다음 **기존 업무 화면 기준**을 우선합니다. 경계값은 `max-width`이므로 예를 들어 980px 자체도 좁은 shell 규칙에 포함됩니다.

| 뷰포트 | 현행 동작 | 후속 구현 기준 |
| --- | --- | --- |
| 1240px 초과 | 넓은 shell, 기본 297px sidebar | 콘텐츠 max-width 유지. 내용이 좁아질 때만 rail·보조 패널 조정 |
| 981~1240px | 좌/우 padding 48/24px, 메시지 행 내부가 한 열로 재배치 | 데이터·상태를 숨기기보다 행을 재배치 |
| 621~980px | Sidebar가 72px 상단 bar·전체 화면 메뉴로 전환, shell 한 열 | 제목·상태·핵심 CTA 유지. 제안 Side Panel은 전체 화면 보기로 전환 |
| 620px 이하 | 본문 좌우 16px, toolbar·일부 탭·행동이 세로로 배치 | 주요 작업 hit area ≥44px, 긴 상태는 줄바꿈, 가로 스크롤 없이 읽기 |
| 공통 UI 820px 이하 | 공통 Modal 여백 16px, footer 세로 역순, 공통 탭 세로 배치 | 화면별 탭 override와 함께 확인. 메시지 목록은 620px에 별도 규칙이 있어 일괄 동작으로 가정하지 않음 |

공개·인증의 1020/760/480/380px, 학부모 목록의 1360/700px, 관리자·일부 기능의 640px, 자녀 입력의 600px 등 추가 경계도 존재합니다. 목적을 확인한 후 정리하고 이번 문서의 표만으로 삭제하지 않습니다.

검증 폭은 **제안** 320, 375, 620, 621, 820, 980, 981, 1240, 1440px입니다. 높이 520/720px 부근의 Sidebar 예외도 확인합니다. 긴 한국어 제목·긴 계정명·7자리 이상의 count·여러 badge로 확인하며, 숫자 잘림이나 중요한 CTA의 화면 이탈을 방지합니다. 입력 중 가상 키보드가 뜨면 마지막 field·오류·전송 버튼까지 스크롤할 수 있어야 합니다.

## 9. Accessibility

목표는 WCAG 2.2 AA를 고려한 구현입니다. 다음은 실제 기준과 프로젝트의 강화된 목표를 구분합니다. 아래 W3C 링크는 W3C 공식 GitHub Pages의 Understanding 문서입니다.

### 대비와 의미

일반 텍스트는 **4.5:1 이상**, 큰 글자는 **3:1 이상**이 기준입니다. 큰 글자 기준은 일반 18pt(약 24px) 또는 굵은 14pt(약 18.67px)에 해당하는 크기입니다. 혼동을 줄이기 위해 티처허브는 안내·배지·버튼·본문에 4.5:1을 기본 목표로 씁니다. [W3C Contrast Minimum](https://w3c.github.io/wcag/understanding/contrast-minimum.html)

control을 식별하는 필수 경계·아이콘·선택·focus 신호는 인접 면과 **3:1 이상**을 확인합니다. 모든 장식 divider가 3:1이어야 하는 것은 아닙니다. 경계 외에 control을 식별할 신호가 없다면 낮은 대비의 경계만으로 구현하지 않습니다. [W3C Non-text Contrast](https://w3c.github.io/wcag/understanding/non-text-contrast.html)

다음은 CSS의 불투명 sRGB 두 색으로 계산한 대비이며 소수 둘째 자리로 표시했습니다. 실제 화면의 opacity·배경·font·중첩 효과는 후속 브라우저 검증이 필요합니다. 반올림 전 값으로 기준 충족 여부를 판정합니다.

| 조합 | 계산 대비 | 판단·후속 대응 |
| --- | --- | --- |
| 흰 글자 / primary `#3b5bdb` | 5.67:1 | 기본 작은 CTA에도 사용 가능 |
| muted `#888888` / 흰색 | 3.54:1 | 12~16px 필수 텍스트에는 부족. 제안 `#666666`은 5.74:1 |
| 흰 글자 / danger `#fd2d27` | 3.76:1 | 현재 작은 긴급 배지·danger 버튼 개선 필요. 기존 `#d9231f` 면은 4.99:1 |
| danger 글자 `#fd2d27` / danger-subtle `#ffecef` | 3.31:1 | 작은 위험 글자 개선 필요. 제안 `#b91c1c`는 5.70:1 |
| pink `#ff4b6c` / 흰색 | 3.24:1 | 16~20px/400~600 분석 label은 일반 텍스트 기준으로 검토. 기본 글자색 사용을 우선 |
| 경계 `#a2a2a2` / 흰색 | 2.55:1 | 식별에 필수인 control 경계는 보완. 제안 재사용 `#888888`은 3.54:1 |

색만으로 위험도·작성자·선택·오류를 알리지 않습니다. 위험도는 단계명, 잠금은 잠금 아이콘과 문장, 사람 검토는 검토자 역할과 결과를 함께 제공합니다. 오류를 보려면 hover해야 하는 UI를 만들지 않습니다.

### 키보드·터치·보조 기술

- **터치 목표는 프로젝트 기준 44×44 CSS px 이상**으로 제안합니다. WCAG 2.2 AA의 최소 target 기준은 24×24px 또는 정해진 간격·예외 조건이며, 44px을 AA의 일괄 필수값으로 설명하지 않습니다. 작은 그림은 그대로 두고 button padding으로 영역을 확보합니다. [W3C Target Size Minimum](https://w3c.github.io/wcag/understanding/target-size-minimum.html)
- Tab/Shift+Tab으로 모든 작업에 접근하고 Enter/Space로 실행합니다. Slider는 방향키와 현재 점수·단계의 접근 가능한 설명을 제공합니다. 공통 Tabs 키보드 처리를 재사용합니다.
- dialog·패널은 제목 연결, 적절한 초기 focus, modal일 때 focus 순환·배경 조작 차단, Escape, 닫은 뒤 호출 지점 focus 복귀가 필요합니다. 처리 중 닫기 정책은 초안 보존과 기존 중복 요청 방지를 유지하는 범위에서 결정합니다.
- field는 label·설명·오류를 연결합니다. 현재 field 컴포넌트는 helperText와 error를 모두 `aria-describedby`에 넣어도 error가 있으면 helper 본문은 렌더하지 않는 경우가 있으므로 유효한 id만 연결되도록 후속 점검합니다.
- 아이콘 단독 행동에 `aria-label`을 주고 장식 SVG는 `aria-hidden` 처리합니다. native `title`이나 Tooltip만으로 행동의 이름을 제공하지 않습니다.
- 로딩·저장·검토 완료는 적절한 live region으로 한 번 알립니다. 긴급 오류 외에는 모든 작은 갱신을 alert로 읽지 않습니다.
- 200% 텍스트 확대와 320 CSS px 폭에서 필수 정보·작업이 사라지지 않게 합니다. sticky 도구가 focus된 control을 가리지 않게 합니다.
- hover/focus 추가 콘텐츠는 닫을 수 있고, 포인터를 옮겨 읽을 수 있고, 읽는 동안 유지되어야 합니다. [W3C Content on Hover or Focus](https://w3c.github.io/wcag/understanding/content-on-hover-or-focus.html)

## 10. Do's & Don'ts

| Do | Don't |
| --- | --- |
| 기존 primary·Pretendard·spacing·공통 UI 재사용 | 화면마다 비슷한 파랑·새 서체·자체 버튼 추가 |
| AI 분석·교사 검토·관리자 결정·현재 적용을 명시 | `AI 최종 위험도`만으로 최종 권위 표현 |
| 위험 단계와 상담·공유·승인·잠금을 각각 표시 | 긴급이므로 관리자 공유·신고도 끝났다고 표시 |
| 판단 이유와 실제 근거 구간을 구분 | 근거 없음·미확인을 “안전” 또는 “미탐지”로 치환 |
| 원문은 기존 권한·확인·기록 절차를 거쳐 열람 | 요약·Tooltip에 원문을 우회 노출 |
| 실패·미제공·권한 제한을 구체적으로 설명 | 빈 카드·무조건 0건·성공형 색으로 실패 은폐 |
| 중요한 잠금 사유를 행동 옆 본문에 표시 | disabled 버튼에만 hover 설명 제공 |
| 긴급 절차는 보이는 곳에 유지 | 긴급 경고 점멸·자동 팝업 중첩·색만 사용 |
| 긴 글과 메타의 대비·행간 확인 | 가독성을 위해 필요한 정보까지 10~12px로 축소 |
| 현재 목록·초안 맥락을 보존하는 보조 패널 | 근거 하나마다 새 전체 페이지·중첩 dialog 생성 |

## 11. 티처허브 전용 UX 원칙

### 11.1 메시지함과 상세: 맥락을 유지하는 정보 계층

목록의 첫 읽기 순서는 **누가 보냈는가 → 어떤 문의인가 → 누구의 작업 차례인가 → 위험·잠금·검토 상태 → 최근 시각**입니다. 현재 상담 상태 filter, 검색, 상세 filter(위험도·정렬), 전체·중요·임시저장 탭을 재사용합니다. 모든 필터를 Modal로 옮기지 않습니다. 적용 중인 필터 개수·초기화를 유지하고 결과 0건에서는 조건 해제 행동을 제공합니다.

현재 `ThreadRow`는 Low 외의 단계를 모두 `주의 필요`로 표시하며, 목록에서 4단계 RiskBadge를 직접 보여 주지 않습니다. 서버 목록 DTO에는 `riskLevel`은 있지만 `safetyLock`은 없어 목록만으로 잠금 해제 여부를 알 수 없습니다. 단계 표시는 제공된 등급을 이용해 보완하되, 잠금·승인 상태는 실제 응답이 있을 때만 표시하는 것이 후속 기준입니다.

위험도 정렬은 기존 mock에 있지만 서버 목록은 최신순·오래된순만 지원합니다. 서버 모드에서 지원하지 않는 정렬을 가능하다고 문서나 UI에 표시하지 않습니다. 서버의 일부 페이지만 읽고 전체 위험도 정렬을 했다고 표현하지 않습니다.

상세의 권장 순서는 **메시지 식별 정보 → 현재 적용 위험도와 잠금·차례 → 대화/AI 분석/처리 기록 → 현재 가능한 다음 행동**입니다. 긴급 또는 safetyLock 안내는 다른 탭을 열어도 작업 영역에서 놓치지 않도록 하는 것이 후속 목표입니다. 이동 전 목록의 검색·filter·선택·scroll 위치를 복원하는 방향을 검토하되 서버 조회 범위와 기존 권한을 유지합니다.

대화는 상대방 메시지·교사 전송 메시지·AI 완충 요약을 구분합니다. `BufferedSummaryCard`는 학부모 원문 자체가 아닙니다. **제안 문구** `AI 완충 요약 · 학부모 메시지 기반`을 쓰고 `원문 보기`, `판단 근거`를 같은 영역에서 제공합니다. 요약 실패를 이전 메시지의 요약으로 대신하지 않습니다. 모바일에서는 좌우 방향만으로 작성자를 구분하지 않도록 역할 label을 남깁니다.

### 11.2 AI가 한 작업과 사람이 결정한 작업

| 영역·주체 | 표시할 정보 | 행동·권위의 경계 |
| --- | --- | --- |
| AI 분석 | `AI 위험 분석`, 시스템 위험도, 요소별 상태·이유·근거, 제공되는 분석 시각 | 분석은 참고 정보. 승인·확정·신고 완료 label을 붙이지 않음 |
| AI 완충 요약 | AI가 요약했다는 label, 대응하는 메시지·시각 | 학부모의 실제 발언·합의로 표시하지 않음 |
| AI 답변 초안 | `AI 답변 초안`, 생성 중/실패/수정 상태, 제공되는 관련 자료 | 자동 생성은 최종 전송과 별개. 기존 최초 진입 생성 흐름은 유지 |
| 교사 위험도 검토 | `교사 검토 위험도`, 1~7점·단계, 검토 사유, 제공되는 검토자·시각 | 저장·긴급 하향 요청·관리자 승인을 구분. 교사 수정만으로 잠금 해제되지 않음 |
| 관리자 재검토 | `관리자 결정`, 승인 대기/반영됨/반려됨, 지정 검토자·시각·사유(제공 범위) | 승인과 잠금 해제는 별도 작업 |
| 실제 업무 적용 | `현재 적용 위험도`, 독립된 `안전 잠금`, 답변 차례·가능 행동 | 기존 서버 상태와 판단 함수의 결과를 표시. UI에서 새 판정 계산 금지 |
| 최종 답변 | 수신자·실제 전송 본문·교사의 확인·전송 결과 | AI 생성·초안 저장을 전송 완료로 표시하지 않음 |

현재 `MessageContextCard`의 `AI 최종 위험도`는 **제안** `AI 분석 위험도`로 바꿉니다. AI 등급 자체와 실제 업무 적용 등급을 동시에 보여야 “최종”의 주체가 혼동되지 않습니다. 처리 기록도 `AI 분석`, `교사 검토`, `관리자 결정`, `교사 전송`의 역할과 시각을 읽을 수 있게 합니다.

제안 표시 예:

```text
AI 분석 위험도       긴급 (Emergency)
교사 검토            위험 (High)으로 하향 요청
관리자 재검토        관리자 승인 대기
현재 적용 위험도     서버가 제공한 현재 등급
안전 잠금            유지 중 · 답변 생성 및 전송 제한
```

위 예시의 “하향 요청”은 “반영 완료”가 아닙니다. 존재하지 않는 검토자·분석 시각·신뢰도 %를 만들어 채우지 않습니다. 제공되지 않은 메타는 생략하거나 `제공되지 않음`으로 설명합니다. AI 신뢰도 점수·오류 확률과 1~7 위험 점수도 혼동하지 않습니다. `AiJudgmentNotice`의 참고 정보 안내는 분석·답변 작성 영역에서 재사용합니다.

### 11.3 Low / Medium / High / Emergency

아래는 **현행 타입과 매핑**입니다. 서버 enum, 내부 값, 한국어 label을 변경하지 않습니다. 점수는 교사 화면의 기존 1~7 척도이며 새 임계값 제안이 아닙니다. 서버 0~70 점수의 표시 변환은 기존 `toDisplayRiskScore`를 따르고 등급은 서버 값 또는 기존 규칙의 결과를 사용합니다.

| 서버 / 내부 / tone | 표시명·기존 척도 | 현재 교사 badge 색 | 후속 시각 기준 |
| --- | --- | --- | --- |
| `LOW` / `low` / `normal` | 일반 (Low), 1~2 | canvas `#f8f8f8` / primary text | 같은 중립색. “안전 보장”·초록 체크로 표현하지 않음 |
| `MEDIUM` / `medium` / `attention` | 주의 (Medium), 3~4 | `#fff180` / primary text | 공통 `#fff5cf` 면으로 정리하는 제안. 주의 label 필수 |
| `HIGH` / `high` / `danger` | 위험 (High), 5~6 | `#fee9eb` / `#fd2d27` | `#ffecef` 면·제안 readable 위험 글자 |
| `EMERGENCY` / `emergency` / `urgent` | 긴급 (Emergency), 7 | `#fd2d27` / 흰색 | 기존 진한 빨강 `#d9231f` 재사용·흰색 제안. 긴급 label·절차·잠금 사유 함께 |

목록은 한국어 단계명, 상세에는 영어 병기를 보조적으로 사용할 수 있습니다. 어떤 화면에서도 단계 순서·명칭·의미가 달라지면 안 됩니다. 점수 slider는 현재 값, 해당 단계, 판단 예시, 저장 전 미리보기임을 설명합니다. 색 gradient만 보고 값을 선택하게 하지 않습니다.

현재 `serverThreads.ts`의 목록 변환은 `riskLevel:null`을 Low tone으로 fallback합니다. 이는 “미분석을 안전 등급처럼 보이지 않게 한다”는 표시 기준과의 충돌입니다. 후속 이슈에서 API의 null 의미와 조회 완전성을 확인하고 표시 상태를 분리해야 합니다. 이번 문서로 기존 위험도 변환·판정 함수를 바꾸지는 않습니다.

**현행 작업 제약을 유지하는 표시 규칙**:

| 조건 | 사용자에게 설명할 현재 동작 |
| --- | --- |
| Low·Medium, 잠금 없음 | 개별 AI 초안 사용 가능 조건을 기존 함수·서버 응답으로 판단. 생성 뒤 교사가 확인·수정·최종 전송 |
| High, 잠금 없음 | 개별 AI 생성 초안은 제공하지 않음. 사용 가능한 승인 공식 템플릿이 있으면 기존 제한형 편집. 일치하는 템플릿이 없거나 조회에 실패한 경우의 기존 직접 작성 fallback을 유지 |
| Emergency 또는 `safetyLock:true` | 위험도와 별개로 답변 생성·작성·전송 제한을 유지. 공식 절차·기존에 허용된 원문·근거 확인을 안내 |
| 분석 `loading` / `failed` | `isReplyLocked`에 따른 제한을 유지하고 확인 중/실패·재시도 표시 |
| 분석 없음 `unavailable` | 미분석을 Low·미탐지로 간주하지 않음. 허용 작업은 기존 판단 함수의 결과를 따르며 문서에서 새 차단 규칙을 만들지 않음 |
| 서버 답변 차례가 아님·상담 완료 | 위험과 다른 이유임을 설명. `getServerReplyBlockReason`과 기존 저장·전송 제약 유지 |

기본 근거: [messageRules.ts](src/features/message/messageRules.ts), [serverReplies.ts](src/features/message/serverReplies.ts), [답변 템플릿 가이드](docs/teacher-reply-templates.md), [답변 API 가이드](docs/teacher-reply-api.md). 화면 버튼과 실제 요청 직전의 기존 차단을 모두 보존합니다. UI 문서가 서버의 안전 보장을 새로 약속하지 않습니다.

### 11.4 판단 근거·불확실성·원문

위험 요소 하나는 **요소 이름 → 분류 상태 → AI 판단 이유 → 근거 구간 → 원문에서 확인** 순으로 구성합니다. `RiskClassificationPanel`의 8개 분류와 `getRiskClassifications`를 재사용합니다.

| 상태 | 기존 label | 표현 규칙 |
| --- | --- | --- |
| `PRESENT` | 탐지 | 위험 강조·이유. 권한과 실제 근거가 있을 때 인용 구간 제공 |
| `ABSENT` | 미탐지 | 중립 표현. 해당 항목이 탐지되지 않았다는 뜻이며 전체 안전 보장 아님 |
| `BOUNDARY` | 경계 | 주의 표현·추가 확인. 탐지 확정으로 바꾸지 않음 |
| `UNKNOWN` | 미확인 | 중립·“분류 결과를 확인하지 못했습니다”. 미탐지로 바꾸지 않음 |

누락·중복·유효하지 않은 분류값을 프론트에서 `ABSENT`로 새로 추정하지 않습니다. 다만 현행 서버 어댑터는 완료된 분석의 `detectedFactors`를 해석하는 별도 계약을 사용하므로 변환 로직은 그대로 둡니다. 관리자 패널의 빈 배열이 “미탐지”를 보장하는지는 응답 계약을 확인해야 하며, 단순 빈 목록만으로 “안전”을 표현하지 않습니다.

근거는 원문 인용, 이유는 분석 해석으로 별도 제목을 붙입니다. 제공되지 않은 인용은 `제공된 근거 구간이 없습니다`로 표시합니다. 원문을 볼 권한·데이터가 없으면 그 사유를 표시합니다. 요약·Tooltip·접근성 label에 보호된 원문을 넣어 권한을 우회하지 않습니다.

현재 `OriginalMessageViewer`의 일치 구간 하이라이트와 요소 선택 연결을 재사용합니다. 원문 열람 전 안내·권한 확인·기존 열람 기록을 유지합니다. Side Panel로 바꾸더라도 동일합니다. 개인정보 마스킹·요약 실패 구분도 [안전 UI 가이드](docs/privacy-safety-ui.md)에 따릅니다.

`studentSafetySignal`은 메시지 위험도와 별개입니다. `NONE`은 기존처럼 카드 숨김, `POSSIBLE`은 `추가 확인 필요`, `URGENT_REVIEW`는 `긴급 확인 필요`와 공식 절차 안내를 유지합니다. 자동 신고·자동 관리자 공유가 실행된 것처럼 표시하지 않습니다.

### 11.5 관리자 공유·검토 상태·safetyLock

다음 상태 축은 병합하지 않습니다. 상담의 `before/inProgress/complete`, 서버의 민원 상태·답변 차례도 아래 공유 상태와 별개입니다.

| 축 | 기존 값과 label | 시각·행동 기준 |
| --- | --- | --- |
| 공유 처리 | `NOT_SHARED` 공유 전, `SHARED` 확인 대기, `UNDER_REVIEW` 검토 중, `COMPLETED` 처리 완료 | 기존 StatusChip default/pending/progress/complete 매핑. 교사에게는 “관리자 확인 대기/검토 중/처리 완료”로 주체 표시 |
| 긴급 하향 재검토 | `PENDING_ADMIN_APPROVAL` 관리자 승인 대기, `APPLIED` 반영됨, `REJECTED` 반려됨 | 공유와 독립. 기존 pending/complete/review chip 매핑과 명시 label 사용. 반려를 시스템 오류·분석 실패로 표현하지 않음 |
| 안전 잠금 | `safetyLock:true/false` | 잠금 아이콘·유지 중/해제됨·제한 사유. 위험 badge 또는 처리 완료 chip으로 대체 불가 |

재검토 상태가 `null`이면 승인 대기가 아닙니다. 요청이 없는 상태와 조회 실패를 구분합니다. 잠금 값이 아직 제공되지 않았다면 `해제됨`이라고 추정하지 않습니다.

기존 제약은 [escalationRules.ts](src/features/escalation/escalationRules.ts), [AdminProcessPanel](src/features/admin/components/AdminProcessPanel.tsx), [관리자 공유 가이드](docs/admin-escalation.md)를 따릅니다.

- 공유 섹션은 High·Emergency에서 보일 수 있지만, 실제 공유 활성 조건은 서버 `currentRiskLevel === EMERGENCY`입니다. High에 임의로 활성 버튼을 제공하지 않고 현재 제한 사유를 설명합니다.
- `SHARED → UNDER_REVIEW → COMPLETED` 순서를 유지합니다. 관리자 승인 대기 중 처리 완료 제한을 유지합니다.
- 긴급 하향 요청의 승인·반려와 안전 잠금 해제는 별도 작업입니다. **승인·처리 완료·교사의 위험도 수정·재검토 요청은 자동 잠금 해제가 아닙니다.**
- 현재 UI의 결정 가능 조건과, 결정 뒤 지정 검토자의 별도 잠금 해제 조건을 유지합니다. `COMPLETED`만 보고 답변 가능으로 표시하지 않습니다. 잠금 해제 후에도 Emergency·분석·차례 등 다른 제한을 확인합니다.
- 요청 중 중복 조작을 막고, 실패·409 충돌 시 기존 재조회와 사유를 보여 줍니다. 응답이 확인되기 전 성공 chip이나 “잠금 해제됨”을 보여 주지 않습니다.

잠금 안내의 **제안 문장 구조**는 `현재 답변이 제한되어 있습니다 → 이유: 안전 잠금 유지 → 해제 주체: 지정 검토자 → 가능한 다음 행동: 기존 재검토/공식 절차`입니다. 화면상 비활성 CTA만 남기지 않습니다. 관리자 화면에는 현재 위험도·요청 위험도·결정 상태·잠금을 한 그룹에서 비교할 수 있게 배치합니다.

### 11.6 Tooltip 및 Information 아이콘

| 정보 종류 | 표시 방식 | 예 |
| --- | --- | --- |
| 짧은 보조 용어 | Tooltip, 1~2문장, 행동·링크 없음 | “완충 요약은 위험 표현의 노출을 줄인 AI 요약입니다.” |
| 클릭해 읽는 짧은 추가 설명·링크 | 기존 Popover, focus·닫기 보완 전제 | 분류 기준 설명, 관련 문서 링크 |
| 필수 판단·오류·권한·잠금 이유 | 본문 inline notice | “관리자 승인을 받아도 안전 잠금은 별도로 해제해야 합니다.” |
| 긴 근거·원문·규정 | Accordion 또는 제안 Side Panel | 항목별 판단 이유, 문서 버전·조항 |
| 상태를 실제 바꾸는 결정 | Modal | 최종 전송, 안전 잠금 해제 |

Information 아이콘은 질문할 만한 개념 label 옆에 놓고, 같은 설명을 모든 행에 반복하지 않습니다. **제안** 의미 설명 아이콘 16~20px, 클릭 영역 44px. 클릭 가능하면 button과 `aria-label="완충 요약 설명"`처럼 목적을 제공합니다. 단순 notice 장식이면 `aria-hidden`으로 본문과 중복 읽기를 피합니다.

현재 Tooltip은 focus 가능한 wrapper와 hover CSS, `pointer-events:none`을 사용하며 Escape 닫기·터치 클릭·화면 경계 보정은 없습니다. focusable 자식을 감싸면 중복 Tab 정지도 생길 수 있습니다. 후속 개선 전에는 필수 안내·긴 설명에 사용하지 않습니다. Tooltip 내용 위로 포인터를 옮겨 읽을 수 있게 하고 Escape·focus 이탈·터치 닫기 정책을 검증합니다. 정보가 길어지면 Popover로 전환합니다.

### 11.7 Modal·Side Panel로 Depth 최소화

현재 원문은 상세 내부 `originalViewer` 상태로 본문을 전환하고, 규정 원문은 `RegulationSourceDialog`, 각종 확인은 두 종류 dialog를 사용합니다. 공통 Side Panel은 **현재 없으며 아래는 제안·신규 구조**입니다.

| 상황 | 후속 권장 | 유지할 맥락 |
| --- | --- | --- |
| 요소별 판단 이유 | 현재 위험 분석 탭 안 Accordion | 열어 둔 요소·선택 구간 |
| 대화·답변을 보며 원문·긴 근거 비교 | 넓은 화면의 Side Panel | 메시지 id·탭·작성 중 초안·선택 위치 |
| 최종 전송·잠금 해제·원문 열람 전 확인 | Modal 한 개 | 결정 대상·결과·취소 후 복귀 |
| 자세한 외부 공식 절차 | 기존 가이드·공식 문서 경로 | 돌아갈 메시지 맥락 |

**제안 치수·동작**: 데스크톱 패널 폭은 400~520px(기존 Modal 폭에서 재사용), 본문 padding 24px, 닫기와 제목을 고정합니다. 원래 본문이 최소한의 가독 폭을 잃으면 패널을 동시에 띄우지 않습니다. 980px 이하에서는 전체 화면 보기·좌우 16px로 전환하며 단일 읽기 영역을 제공합니다.

논리적 구조는 `목록 → 메시지 작업 → 보조 정보 1개`까지를 원칙으로 합니다. Modal 위 Modal, 패널 위 또 다른 패널을 쌓지 않습니다. 필요한 확인은 보조 surface를 먼저 교체·닫은 뒤 표시하고, 확인 뒤 동일 맥락으로 복귀합니다. 패널은 독립 URL·뒤로 가기·새로고침 복원 가능성을 검토하지만 이번에 라우팅을 바꾸지는 않습니다.

비모달 패널은 `aside`/region과 제목, 명시적 focus 이동·복귀를 사용하고 배경을 계속 조작할 수 있게 합니다. 모달·모바일 전체 화면 패널은 공통 Modal의 접근성 패턴을 재사용합니다. 원문 열람 동의·기록, 최종 전송 확인, 기존 안전 제한을 depth 축소를 이유로 생략하지 않습니다.

### 11.8 주요 사용자 작업의 읽기·조작 기준

답변 작성 영역의 순서는 **현재 답변 가능 상태 → 관련 규정·근거 → AI 초안/직접 작성/공식 템플릿 → 현재 초안 → 임시저장·최종 전송**입니다. 기존 탭별 초안과 서버 단일 초안의 차이를 유지하고 저장 상태는 실제 저장된 탭에만 표시합니다.

최종 전송에서는 현재 수신자·본문을 확인하고 교사가 직접 확인했다는 기존 체크를 유지합니다. `AI 초안 생성됨`, `임시저장됨`, `전송 완료`를 같은 성공 문구로 합치지 않습니다. 원문·판단 근거·관리자 검토 사유를 보는 동안 작성한 내용을 잃지 않게 합니다.

처리 결과와 예시 자료도 구분합니다. 현재 규정 출처의 예시·구버전 경고를 유지하고 예시 자료를 실제 학교 규정으로 소개하지 않습니다. mock·HTTP 모드에서 제공되는 기능과 데이터가 다르면 현재 어댑터의 실제 결과를 따릅니다. 존재하지 않는 관리자 통보·검토자 배정·전송 성공을 디자인 문구로 추가하지 않습니다.

## 12. 기존 구현과의 차이 및 후속 개선 우선순위

### 유지할 요소

기존 블루·중립 면·Pretendard, 4px 간격 토큰, 8px control, 297/100px Sidebar와 72px 모바일 header를 유지합니다. Button·field·Tabs·Accordion·Modal, AI 참고 안내, 8개 분류, 원문 하이라이트, 제한형 템플릿, 최종 전송 확인, 재시도·실패 UI를 재사용합니다. 위험도·공유·승인·잠금의 타입과 판단 함수는 디자인 개선과 분리해 그대로 둡니다.

### 차이·충돌·개선 backlog

아래는 **이번에 수정한 항목이 아닌 후속 이슈 후보**입니다. P0는 다음 UI 구현에서 먼저 다룰 오인·조작 문제, P1은 공통 기반, P2는 구조 개선입니다. 실제 발생 빈도는 사용자 검증으로 보완합니다.

| 우선순위 | 현재 구현·문서 기준의 충돌 | 근거 위치 | 후속 작업과 완료 조건·이유 |
| --- | --- | --- | --- |
| P0 | `AI 최종 위험도`는 사람이 결정한 최종 결과처럼 읽힐 수 있음 | `MessageContextCard.tsx`, 관리자 RiskAnalysisPanel은 이미 시스템/교사/현재 적용 구분 | `AI 분석 위험도`로 출처 명확화, 적용·잠금 별도 표시. 승인 대기·승인 후 잠금 유지 사례에서 오인 없는지 확인 |
| P0 | 목록의 Medium·High·Emergency가 모두 `주의 필요`로 표시되고, null 등급은 Low tone으로 변환됨 | TeacherMessages `ThreadRow`, serverThreads `riskTone`·`toListThread` | 제공된 단계와 미확인 표시를 구분하는 후속 설계. 목록에 없는 잠금·승인 값은 추정하지 않음. 판정 로직은 보존하고 API 계약·표시 상태부터 확인 |
| P0 | 작은 muted·위험·핑크 텍스트, 흰 글자 긴급 badge의 대비 부족 | 9절 대비표, prototype `.ui-badge--critical`, `.ui-field-error`, detail `.board-risk-*`, risk 제목 | 기존 브랜드·면 유지, 2.3 제안 적용·모든 실제 배경 대비 검증. 보이는 중요 정보의 가독성 확보 |
| P0 | BoardConfirmDialog에 초기 focus·Tab 순환·focus 복귀 없음. 공통 Modal에는 구현됨 | `components/BoardConfirmDialog.tsx`, `shared/components/ui/Modal.tsx` | 두 확인 dialog의 접근성 동작 통합. 키보드만으로 전송·원문 열람·잠금 해제 확인/취소 가능 |
| P0 | 뒤로가기 24px, 별표 36px, 확인창 닫기 28px 등 작은 영역. 일부 행동은 37/40px | detail/list/modals CSS | 주요 행동에 프로젝트 목표 44px hit area. 320px·터치에서 인접 작업 오조작 없이 실행 |
| P1 | 공통·board Low/Medium/High palette 차이, 상담 진행 chip 글자색 차이 | prototype `.ui-badge-*`, detail `.board-risk-*`, list `.board-status-chip` | RiskBadge·업무 StatusChip 의미별 규격 정리. 같은 위험 단계는 역할별 화면에서 동일한 label·색 |
| P1 | 미정의 `--font-family-base`, `--font-weight-bold`, root 직접 색·서체 중복 | prototype `body`·avatar, index.css, App.css | 기존 font 스택을 토큰화하고 전역 적용 책임 정리. 모든 역할·공개 화면에서 의도한 font와 fallback 확인 |
| P1 | 버튼 34/37/40/47/52/67px, 굵기 500/600/700·33/58px 간격 등이 화면별 혼재 | prototype, `.board-*`, parent write/review/history | 작업 밀도에 따른 표준 variant·예외 정의. field 오류·focus를 parent override가 가리지 않는지 검증 |
| P1 | Dropdown 방향키·focus 복귀 부족, 수동 상세 nav, Tooltip Escape·터치·포인터 유지 부족 | `Dropdown.tsx`, `Tooltip.tsx`, TeacherMessages 상세 nav | native Select/공통 Tabs 우선, 필요한 공통 컴포넌트 보완. 키보드·터치·화면 경계에서 동등하게 사용 |
| P1 | 관리자 위험 요소 빈 배열의 “없음/미탐지” 안내는 응답 완전성 확인이 필요 | `AdminSharedMessageDetail.tsx` RiskAnalysisPanel | 성공·분석 미완료·UNKNOWN·빈 결과의 계약 확인 후 문구·상태 보완. 판정·어댑터 의미를 임의 변경하지 않음 |
| P1 | 20px/24px 대화 본문, 10px 모바일 시간, 필수 안내의 작은 글자 | conversation CSS, ParentMessageHistory.css | 실제 긴 한국어 메시지로 행간·메타 최소 크기·대비 확인. 본문 이해와 시간 비교 개선 |
| P1 | Toast가 모든 결과 alert·5초 소멸, 공통 motion 감소 처리 누락 | Toast.tsx, prototype, ApiFeedback.css | 성공/오류 알림 구분·중요 결과 지속 표시, 공통 reduced-motion 보완 |
| P2 | 원문 보기에서 본문 교체, 긴 규정 Modal, 공통 Side Panel 없음 | TeacherMessages `originalViewer`, RegulationSourceDialog | 11.7 패널 설계. 초안·filter·scroll·권한·원문 열람 기록을 유지한 비교·복귀 검증 |
| P2 | shell 축소 여백·상세 폭·breakpoint가 역할별 분산, 1015px 고정 min-height | base/prototype, ParentLayout.css, responsive CSS | 콘텐츠 시작선·높이·반응형 책임 정리. 경계 폭·짧은 창·긴 데이터에서 잘림·빈 스크롤 검증 |
| P2 | 공통 CSS에 이전 shell·페이지 스타일, 도메인 컴포넌트에서 `.board-*` 의존 | teacher-prototype.css, App.css, AdminPages.css | 실제 참조 확인 후 스타일 책임 정리·필요한 Card/Panel 공통화. 일괄 삭제·프레임워크 교체는 별도 판단 |

High 관리자 공유 활성화, 자동 신고·자동 전송, 새로운 위험 임계값, 잠금 자동 해제, 서버 안전 정책 변경은 이 backlog의 디자인 개선에 포함하지 않습니다. 필요하면 별도 제품·안전 정책 이슈에서 결정합니다.

## 13. 후속 구현 검토 기준

각 UX/UI 이슈는 변경 컴포넌트·관련 토큰·현행 정책 제약·적용할 제안 값을 명시합니다. 화면마다 새 토큰을 정의하기 전에 공통 토큰과 컴포넌트를 확인합니다. 이 문서의 새 토큰을 실제 선언하지 않고 `var()`로 참조하지 않습니다.

- 목록·상세·답변·관리자·학부모에서 같은 상태의 label·색·서체가 일치하는가?
- AI 분석과 사람의 검토·최종 전송이 구분되며, 없는 데이터·권한·완료 상태를 만들어 보이지 않는가?
- Low/Medium/High/Emergency, 분석 로딩·실패·미제공, 승인 대기·반려·반영, 승인 후 잠금 유지·해제 사례를 확인했는가?
- High 템플릿 있음/없음, 현재 답변 차례 아님, 공유 불가·API 실패·409에서도 기존 허용·차단 조건을 보존했는가?
- 실제 배경에서 대비, 키보드·focus 복귀, Tooltip·터치, 320px·확대·긴 한국어 데이터·짧은 창을 확인했는가?
- 기존 원문 열람·기록·마스킹·전송 확인을 유지하고, Side Panel·Modal 전환 후 초안과 탐색 맥락이 보존되는가?

이번 문서 작업은 소스 정적 분석, 외부 디자인 문서 확인, 색 대비 계산에 기반합니다. 실제 화면 리팩터링·시각 QA·접근성 적합성 인증은 수행 범위가 아니며, 후속 구현에서 브라우저와 기존 관련 테스트로 검증합니다. 기존 문서에 오래된 mock/API 설명이 섞여 있는 경우 이 문서의 기준은 위에 연결한 실제 코드이며, 백엔드의 실시간 상태를 검증했다고 해석하지 않습니다.
