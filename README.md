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
- `npm run test:auth`: 데스크톱·모바일 인증 플로우 테스트

## 인증 플로우 테스트

현재 인증은 백엔드 없이 Mock API로 동작합니다. 테스트 계정, 자동 테스트 실행 방법, 만료·오류 재현 방법은 [인증 테스트 가이드](docs/auth-mock-testing.md)를 참고하세요.

개인정보 마스킹·안전 상태 UI와 실패 재현 방법은 [개인정보 및 안전 UI 가이드](docs/privacy-safety-ui.md)를 참고하세요.
