# AI 상상챌린지 Frontend

React, TypeScript, Vite 기반 프론트엔드 프로젝트입니다.

## 시작하기

```bash
npm install
npm run dev
```

## 스크립트

- `npm run dev`: 로컬 개발 서버 실행
- `npm run build`: TypeScript 검사 후 프로덕션 빌드
- `npm run lint`: ESLint 검사
- `npm run preview`: 빌드 결과 미리보기
- `npm run test:auth`: 데스크톱·모바일 인증·메시지·공통 UI 회귀 테스트

## 인증 플로우 테스트

기본 인증 모드는 백엔드 없이 동작하는 Mock API이며, `VITE_AUTH_API=http`이면 서버 API를 사용합니다. 테스트 계정, 자동 테스트 실행 방법, 만료·오류 재현 방법은 [인증 테스트 가이드](docs/auth-mock-testing.md)를 참고하세요.

개인정보 마스킹·안전 상태 UI와 실패 재현 방법은 [개인정보 및 안전 UI 가이드](docs/privacy-safety-ui.md)를 참고하세요.

공통 UI의 디자인 기준은 [DESIGN.md](DESIGN.md), Issue #72의 적용 내용·토큰·검증 결과는 [공통 UI 적용 및 검증](docs/ui-style-improvements.md)을 참고하세요.

문의 흐름과 HTTP 계약은 [학부모 작성·분석·제출](docs/parent-message-api.md), [학부모 문의 내역](docs/parent-message-history.md), [교사 메시지함](docs/teacher-inbox-api.md), [교사 분석 화면](docs/teacher-message-analysis.md), [교사 답변](docs/teacher-reply-api.md), [답변 예시 편집](docs/teacher-reply-templates.md), [관리자 공유·재검토](docs/admin-escalation.md)에 정리했습니다. #77의 AI 잠정 분석·내부 오류·Severity·안전 신호 및 100점 시스템 점수와 교사 7단계 구분은 학부모 작성·분석·제출 문서에서 확인할 수 있습니다.

서버 연결 환경 변수와 rewrite 설정은 [배포 가이드](docs/deployment.md), 가입 입력값과 서버 매핑은 [회원가입 정보 가이드](docs/parent-signup-child-info.md)를 참고하세요.
