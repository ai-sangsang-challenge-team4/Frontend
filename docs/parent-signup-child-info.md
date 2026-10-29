# 회원가입 학교·자녀·소속 정보 (#36·#44 → 백엔드 #34 반영)

## 정책 변경

백엔드 `SignupRequest`(dev, PR #34)가 모든 역할에 `name`을 필수로 받고, 교사 이름을 교직원 명부와 대조합니다. 그래서 이전 정책 **"학부모 본인 이름은 입력받지 않는다"를 폐기**하고 학부모도 본인 이름을 입력합니다. 자녀 이름(`studentName`)은 별도 필드로 학생 실명과 대조됩니다.

| 역할 | 화면 입력 | 서버로 보내는 값 |
| --- | --- | --- |
| 공통 | 이름, 아이디(이메일), 비밀번호 | `name`, `email`, `password`, `role` |
| 학부모 | 기본 정보: 학교 검색 → 학년 → 반 → 번호, 자녀 이름 | `schoolId`, `schoolClassId`, `studentId`, `studentName` |
| 교사 | 소속 정보: 소속학교 검색, 교번(#44) | `schoolId`, `employeeNo` |

폼 상태(`SignupInput`, `ChildSignupInfo`)는 `authState.ts`의 `toSignupRequest()`로 백엔드 `SignupRequest`가 됩니다. `schoolName`·`grade`는 화면 구성용이라 보내지 않습니다.

## 화면 규칙

- 계정 유형 아래에 역할별 정보(학부모 `기본 정보`, 교사 `소속 정보`), 그 아래 이름을 표시합니다.
- 학교는 검색 결과에서 선택해야 합니다. 이름을 입력하기만 하면 선택되지 않습니다. 검색은 150ms 디바운스, 이전 요청은 취소합니다.
- 학교 선택 → 학년 → 반 → 번호 순으로 활성화하고, 상위 항목을 바꾸면 하위 항목을 초기화합니다.
- 학년은 서버 허용 범위인 1~6을 표시합니다(서버에 학교급 정보가 없음). 학년을 고르면 `grade` 쿼리로 학급을 조회하고, 응답의 `classNo`로 `N반`을 표시합니다. 학급이 없으면 "선택할 수 있는 반이 없습니다."를 안내합니다.
- 번호는 학생 응답의 `displayName`(예: `5번`)을 그대로 표시하고 값은 학생 ID입니다.
- 계정 유형을 바꿔도 이름·아이디·비밀번호와 역할별 입력값을 유지합니다.
- 학교 검색은 클릭·터치와 방향키·Enter 선택, Escape·포커스 이동 시 닫기를 지원합니다.
- `VITE_AUTH_API=http`에서는 이메일 인증 API가 없어 인증번호 단계를 표시하지 않습니다. mock에서는 기존처럼 인증을 거칩니다.

## 데이터 출처

| 모드 | 학교·학급·학생 번호 | 가입 |
| --- | --- | --- |
| `VITE_AUTH_API=http` | `GET /auth/schools?keyword=`, `/auth/schools/{schoolId}/classes?grade=`, `/auth/classes/{schoolClassId}/students` (공개 API) | `POST /auth/signup` |
| mock(기본) | `mockSignupOptionsApi.ts` 예시 데이터(상상초·중·고, 학년별 1~3반, 반별 1~30번). 화면에 예시 데이터임을 표시 | localStorage `teacher-hub.auth-accounts` |

학교·학급·학생 ID와 학생 이름이 서로 맞는지는 서버가 판단합니다(`SIGNUP_REFERENCE_NOT_FOUND` 404, `SIGNUP_VALIDATION_FAILED` 400). 이 오류들은 서버 메시지를 그대로 보여 줍니다. 프론트 검증은 "선택했는지"와 공백 이름만 확인합니다.

dev 프로필 백엔드에는 상상초등학교(2026학년도 3학년 2반, 학생 번호 `DEV-20260001`, 이름 `Demo Student`)와 가입 가능한 교사 명부(`DEV-2026-002`, 이름 `가입용 교사`)가 있습니다.

비밀번호는 서버가 8~100자를 받지만 화면은 기존 정책대로 8~20자로 제한합니다.

## 검증

```bash
npm run build
npm run lint
npm run test:auth -- auth-flow.spec.ts child-signup.spec.ts auth-http-api.spec.ts
```
