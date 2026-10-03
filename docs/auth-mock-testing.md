# Issue #21 인증 플로우 테스트

현재 인증은 백엔드 요청 없이 동작하는 Mock 구현입니다. `authApi.ts`는 화면에서 사용하는 API 진입점이고, 실제 Mock 계정·인증번호·토큰 처리는 `mockAuthApi.ts`에 있습니다. 백엔드 명세가 정해지면 같은 계약을 구현하는 어댑터로 교체합니다.

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
- 이름·이메일·비밀번호 필수값과 비밀번호 확인
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
- 비밀번호 재설정 후 새 비밀번호 로그인

실패 시 `test-results/`에 화면 캡처와 trace가 남습니다. HTML 결과는 `npx playwright show-report`로 확인할 수 있습니다.

## 수동 테스트 계정

| 역할 | 이메일 | 비밀번호 | 로그인 후 화면 |
| --- | --- | --- | --- |
| PARENT | parent@example.com | password123 | /parent |
| TEACHER | teacher@example.com | password123 | /teacher → /teacher/messages |
| ADMIN | admin@teacherhub.local | admin1234 | /admin |

회원가입과 비밀번호 재설정 인증번호는 `123456`입니다. ADMIN은 회원가입 선택지에 포함하지 않습니다. 가입한 계정은 같은 브라우저와 주소에서 다시 로그인할 수 있습니다.

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

이후 로그인하면 로딩 상태와 자동 로그아웃을 확인할 수 있습니다. 세션 만료 시간 설정은 새로 로그인할 때 적용됩니다.

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
  'teacher-hub.auth-password-reset-code',
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
