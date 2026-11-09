# gstack

Use the /browse skill from gstack for all web browsing. Never use mcp__claude-in-chrome__* tools.

Available skills:
- /office-hours — YC 오피스아워 형식으로 제품 가정 검증
- /plan-ceo-review — 문제 재정의 및 10성급 제품 탐색
- /plan-eng-review — 아키텍처, 데이터 플로우, 엣지 케이스 정의
- /plan-design-review — 디자인 평가 (0~10점, AI Slop 감지)
- /design-consultation — 완전한 디자인 시스템 구축
- /design-shotgun — 빠른 디자인 프로토타입
- /design-html — HTML 디자인 생성
- /review — 코드 리뷰 + 프로덕션 버그 탐지 및 자동 수정
- /ship — 테스트 → 푸시 → PR 생성 자동화
- /land-and-deploy — PR 머지 → CI → 프로덕션 검증
- /canary — 배포 후 콘솔 에러, 성능 회귀 모니터링
- /benchmark — Core Web Vitals 기준선 측정
- /browse — 실제 Chromium 브라우저로 웹 탐색
- /connect-chrome — Chrome 연결
- /qa — 실제 브라우저 테스트 + 버그 수정 + 회귀 테스트
- /qa-only — 버그 리포트만 생성 (코드 변경 없음)
- /design-review — 디자인 감사 후 직접 수정
- /setup-browser-cookies — 브라우저 쿠키를 헤드리스 세션으로 가져오기
- /setup-deploy — 배포 설정 자동 감지
- /setup-gbrain — GBrain 설정
- /retro — 주간 회고 (/retro global로 전체 프로젝트 회고)
- /investigate — 데이터 플로우 추적, 가설 검증 (수정 전 반드시 실행)
- /document-release — 배포 후 문서 자동 업데이트
- /codex — OpenAI Codex CLI 독립 코드 리뷰
- /cso — OWASP Top 10 + STRIDE 보안 감사
- /autoplan — CEO → 디자인 → 엔지니어링 리뷰 자동 순서 실행
- /plan-devex-review — DX 리뷰 계획
- /devex-review — DX 리뷰
- /careful — 파괴적 커맨드 실행 전 경고
- /freeze — 파일 편집을 특정 디렉토리로 제한
- /guard — /careful + /freeze 통합 (프로덕션 최고 안전 설정)
- /unfreeze — /freeze 경계 해제
- /gstack-upgrade — gstack 최신 버전으로 업그레이드
- /learn — 학습 모드

## 디자인 가이드

- UI/UX 구현·변경 시 루트의 [DESIGN.md](DESIGN.md)를 참고하고, 기존 토큰·공통 컴포넌트를 우선 재사용합니다. 문서의 기존 값과 후속 제안을 구분합니다.
- 디자인 개선을 이유로 기존 위험도 판정·권한·안전 잠금·전송 정책을 변경하지 않습니다.
