# Issue #21 인증 플로우 테스트

인증은 `VITE_AUTH_API`로 어댑터를 고릅니다. 기본(mock)은 백엔드 요청 없이 동작하는 `mockAuthApi.ts`이고, `http`는 백엔드를 호출하는 `httpAuthApi.ts`입니다. `authApi.ts`는 화면에서 사용하는 API 진입점입니다. 아래 자동 테스트는 mock 기준입니다.

## HTTP 모드 (`VITE_AUTH_API=http`)

| 기능 | API | 비고 |
| --- | --- | --- |
| 로그인 | `POST /auth/login` | `expiresAt = 요청 시각 + expiresIn(초)`. refresh token 없음 |
| 회원가입 | `POST /auth/signup` | 이메일 인증 API가 없어 인증 단계 생략 |
| 사용자 조회 | `GET /users/me` | 응답에 만료 정보가 없어 저장된 `expiresAt` 유지. 5xx면 아래 임시 우회 |
| 로그아웃 | 없음 | 로컬 세션만 삭제(JWT는 만료 전까지 유효) |
| 학교·학급·학생 번호 | `GET /auth/schools…`, `/auth/classes…` | 공개 API |

**`/users/me` 500 임시 우회**: 백엔드 `UserController`가 `@AuthenticationPrincipal Long userId`로 받는데 principal은 `UserDetails`라, 유효한 토큰에도 항상 500을 반환합니다. 이 때문에 새로고침하면 로그인이 풀렸습니다. 백엔드가 고치기 전까지 `httpAuthApi.getCurrentUser`는 **5xx일 때만** 로그인 때 저장한 사용자를 유지합니다. 조건은 저장된 토큰과 같은 토큰이고, 토큰의 `sub`·`email`·`role`이 저장된 사용자와 같고, `exp`가 지나지 않았을 때입니다. 토큰 서명은 프론트에서 검증하지 않지만, 다른 API는 요청마다 토큰을 보내고 401이면 로그아웃됩니다. 401은 기존과 같이 로그아웃, 네트워크 오류는 기존과 같이 "다시 시도" 화면입니다. 백엔드가 고쳐지면 `fallbackUserForToken`을 지웁니다.

dev 프로필 계정: `parent@test.com`, `teacher@test.com`, `admin@test.com` / `Test1234!`. 로컬에서는 Vite 프록시(`VITE_API_BASE_URL=/api`, `VITE_API_PROXY_TARGET`)를 거치며, 프록시가 `Origin` 헤더를 제거합니다(백엔드 CORS는 Vercel Origin만 허용해 다른 Origin은 403).

Mock 계정과 비밀번호, 발급 토큰 기록은 테스트를 위해 브라우저 저장소에 보관됩니다. 실제 서비스의 서버 인증이나 토큰 서명 검증을 대신하지 않습니다. 이전 버전에서 로그인한 세션에는 만료 정보와 발급 기록이 없으므로 한 번 다시 로그인해야 합니다.

## 자동 테스트

```bash
npm install
npx playwright install chromium
npm run test:auth
```

테스트는 `http://127.0.0.1:5180`에 개발 서버를 자동으로 실행하며, 각 테스트는 독립된 브라우저 저장소를 사용합니다. 개발자가 사용 중인 브라우저의 계정이나 로그인 정보는 변경하지 않습니다. 같은 시나리오를 데스크톱 Chromium과 모바일 Chromium에서 실행합니다.

이미 실행한 개발 서버를 사용하려면 다음처럼 지정할 수 있습니다.

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5175 npm run test:auth
```

검증 범위:

- PARENT / TEACHER 회원가입, 이메일 인증, 로그인
- 이름(학부모·교사 공통)·이메일·비밀번호 필수값과 비밀번호 확인, 교사 소속학교·교번(#45)
- 학부모 자녀 정보 필수값, 학교 검색, 학년(1~6)·반·번호의 단계별 활성화·초기화
- HTTP 어댑터의 요청 경로·본문·오류 변환(`auth-http-api.spec.ts`, fetch 대체. 실제 서버 호출 아님)
- 중복 이메일 및 잘못된 로그인 정보
- PARENT / TEACHER / ADMIN 로그인 후 역할별 이동
- 비로그인 접근 제한 및 다른 역할의 페이지 접근 제한
- 로그인 후 원래 요청한 역할 내부 페이지로 이동
- 새로고침 시 토큰으로 현재 사용자 조회 및 상태 복원
- 저장된 사용자 정보가 수정되어도 Mock 조회 결과를 사용
- 복원 중 로딩 상태와 로그인 요청 중 중복 제출 방지
- 사용 중 또는 새로고침 시 토큰 만료 처리
- 등록되지 않은 토큰 및 손상된 저장 데이터 제거
- 사용자 조회 401 응답 시 인증 상태 초기화
- 사용자 조회 503 응답 시 세션 보존 및 재시도
- 다른 탭의 로그인·로그아웃 반영, 늦은 조회 응답 무시
- 인증번호 오류·만료·재전송 및 이메일 변경 중 요청 처리

실패 시 `test-results/`에 화면 캡처와 trace가 남습니다. HTML 결과는 `npx playwright show-report`로 확인할 수 있습니다.

## 수동 테스트 계정

| 역할 | 이메일 | 비밀번호 | 로그인 후 화면 |
| --- | --- | --- | --- |
| PARENT | parent@example.com | password123 | /parent/messages/new |
| TEACHER | teacher@example.com | password123 | /teacher → /teacher/messages |
| ADMIN | admin@teacherhub.local | admin1234 | /admin |

회원가입 인증번호는 `123456`입니다. ADMIN은 회원가입 선택지에 포함하지 않습니다. 가입한 계정은 같은 브라우저와 주소에서 다시 로그인할 수 있습니다.

신규 가입 시 본인 이름이 필요합니다. 학부모는 학교·학년·반·번호·자녀 이름을, 교사는 소속학교·교번을 입력합니다. mock 학교 검색 결과에서 `상상초등학교`(1~6학년), `상상중학교`·`상상고등학교`(1~3학년)를 선택할 수 있습니다. 학교·학급·번호는 예시 데이터이며 Mock 계정에만 저장됩니다. 자세한 내용은 [회원가입 학교·자녀·소속 정보 문서](parent-signup-child-info.md)를 참고하세요.

## 지연·만료·실패 재현

기본 응답 지연은 250ms이고, 로그인 세션은 30분 뒤 만료됩니다. `.env.local`에서 `VITE_MOCK_AUTH_DELAY_MS`, `VITE_MOCK_AUTH_SESSION_TTL_MS`를 설정하면 기본값을 바꿀 수 있습니다. 환경변수 변경 후에는 개발 서버를 다시 시작합니다.

개발 서버에서 브라우저 개발자 도구의 Console로 테스트 설정을 변경할 수도 있습니다. 설정은 `teacher-hub.auth-mock-settings`에 저장되며 개발 환경에서만 적용됩니다.

3초 뒤 만료되는 새 세션과 1초 응답 지연:

```js
localStorage.setItem('teacher-hub.auth-mock-settings', JSON.stringify({
  delayMs: 1000,
  sessionDurationMs: 3000,
}));
```

이후 로그인하면 로딩 상태와 자동 로그아웃을 확인할 수 있습니다. 만료 시 로그인 화면으로 이동하며, "세션이 만료되었습니다. 다시 로그인해 주세요." 토스트를 한 번 표시합니다. 토스트는 5초 뒤 자동으로 사라지거나 닫기 버튼으로 제거할 수 있고, 로그인 페이지 본문에는 만료 문구를 표시하지 않습니다. 세션 만료 시간 설정은 새로 로그인할 때 적용됩니다.

로그인한 상태에서 사용자 조회 실패를 재현하려면:

```js
localStorage.setItem('teacher-hub.auth-mock-settings', JSON.stringify({
  failures: { getCurrentUser: 503 },
}));
location.reload();
```

503에서는 인증 정보를 지우지 않고 재시도 화면을 표시합니다. 설정을 지운 후 화면의 `다시 시도` 버튼을 누르면 기존 로그인 상태가 복원됩니다.

```js
localStorage.removeItem('teacher-hub.auth-mock-settings');
```

`getCurrentUser: 401`로 변경하면 유효하지 않은 인증 정보 처리와 로그인 화면 이동을 재현할 수 있습니다. 로그인 또는 회원가입 자체의 실패는 `failures: { login: 503 }`, `failures: { signup: 503 }`으로 지정합니다. 실패 설정은 제거할 때까지 유지됩니다.

테스트 계정·설정·세션을 모두 초기화하려면:

```js
for (const key of [
  'teacher-hub.auth-accounts',
  'teacher-hub.auth-session',
  'teacher-hub.auth-mock-sessions',
  'teacher-hub.auth-signup-code',
  'teacher-hub.auth-mock-settings',
]) {
  localStorage.removeItem(key);
}
location.reload();
```

이 초기화는 직접 가입한 Mock 계정도 삭제합니다. 다른 기능의 브라우저 저장소는 유지합니다.

## 이슈 체크 범위

UI, 입력 검증, 역할별 이동, 인증 상태 관리, 현재 사용자 조회 흐름, 만료·무효 인증 처리, 로그아웃, 공통 오류·로딩 처리는 **Mock 기준 구현 및 테스트 완료**로 표시할 수 있습니다.

실제 회원가입·로그인·사용자 조회 API 연동, 서버의 인증·권한 확인, 실제 토큰 검증과 재발급은 백엔드 연결 후 확인할 항목으로 남깁니다. 현재 만료 정책은 자동 로그아웃이며 refresh token을 사용한 재발급은 구현하지 않았습니다.
