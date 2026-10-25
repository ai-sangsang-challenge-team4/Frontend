# Issue #36 학부모 회원가입 자녀 정보

## 구현 범위

학부모를 선택했을 때는 계정 유형 바로 아래에 `기본 정보`와 자녀 이름을 표시하고, 이메일 인증·비밀번호 입력을 그 아래에 배치합니다. `기본 정보 *` 제목과 `학교·학급 목록은 예시 데이터입니다.` 안내는 같은 줄에 표시합니다. 학부모 본인 이름은 입력받거나 가입 입력에 포함하지 않습니다. 교사는 기존 이름 입력과 필수 검증을 유지합니다. 교사로 전환하면 자녀 정보의 표시와 검증을 생략하고, 가입 입력에도 자녀 정보를 포함하지 않습니다. 계정 유형을 다시 학부모로 바꾸면 입력했던 자녀 정보를 복원합니다.

- 학교는 검색 결과에서 선택해야 합니다. 학교 이름을 직접 입력하기만 하면 선택되지 않습니다.
- 학교 선택 → 학년 → 반 → 번호 순으로 활성화합니다.
- 초등학교는 1~6학년, 중·고등학교는 1~3학년을 표시합니다.
- 학교를 바꾸거나 검색어를 수정하면 학년·반·번호를 초기화합니다.
- 학년을 바꾸면 반·번호, 반을 바꾸면 번호를 초기화합니다.
- 학교·학년·반·번호·자녀 이름은 필수입니다. 공백 이름과 목록에 없는 값도 거절합니다.
- 학교 검색은 클릭·터치와 방향키·Enter 선택, Escape·포커스 이동 시 닫기를 지원합니다.
- 데스크톱에서는 학교·학년·반·번호를 레이블 옆에 배치하며, 작은 화면에서는 위아래로 배치합니다. 자녀 이름은 전체 너비를 사용합니다.

## 현재 데이터와 저장 범위

기존 인증 어댑터는 `mockAuthApi`이며 실제 회원가입·이메일 인증 API를 호출하지 않습니다. 같은 방식으로 학교·학급 자료를 `src/features/auth/api/mockSchoolDirectory.ts`에 분리했습니다. 화면과 검색 결과에 예시 데이터임을 표시합니다.

상상초등학교·상상중학교·상상고등학교는 가상의 학교입니다. 각 학년의 1~3반과 각 반의 1~30번은 UI 확인용 데이터이며, 실제 학교의 반 수나 학생 수를 의미하지 않습니다. 실제 데이터나 명세가 없는 상태에서 외부 API 경로를 임의로 추가하지 않았습니다.

학부모 가입 입력은 다음과 같습니다. **프론트엔드/Mock 전용 구조이며 서버와 합의한 DTO가 아닙니다.** `schoolId` 역시 예시 ID입니다.

```ts
{
  email: 'parent-signup@example.com',
  password: 'password123',
  role: 'PARENT',
  child: {
    schoolId: 'mock-elementary',
    grade: 6,
    classNumber: 2,
    studentNumber: 17,
    name: '김상상',
  },
}
```

`studentNumber`는 학급 내 학생 번호입니다. 자녀 정보는 화면과 Mock 어댑터에서 검증한 뒤 이름 양끝 공백을 제거하여 `teacher-hub.auth-accounts`의 해당 계정에 함께 저장합니다. 교사 계정에는 `child`를 저장하지 않습니다. 기존 테스트 계정, 로그인 응답, 인증 세션의 `User` 구조는 유지합니다. 서버 저장과 실제 학부모·학생 연결은 아직 수행하지 않습니다.

학부모 신규 계정의 Mock `User.name`에는 화면 표시용 기본 문구인 `학부모`를 사용합니다. 실제 학부모 이름을 수집하거나 교사 입력값·자녀 이름으로 대체하지 않습니다.

## 백엔드 확인 결과

2026-10-25, `Backend` 기본 개발 브랜치 `dev`의 커밋 `05611ec21baa15f638349930621d44bf868c55c5`를 기준으로 확인했습니다.

| 항목 | 확인 결과 | 근거 |
| --- | --- | --- |
| 학교 검색 | 학교 검색 컨트롤러·학교 목록 API 없음 | [개발 브랜치 소스](https://github.com/ai-sangsang-challenge-team4/Backend/tree/05611ec21baa15f638349930621d44bf868c55c5/src/main/java/com/teacherhub) |
| 학년·반·번호 조회 | `SchoolClass`·`StudentClass` 엔티티와 Repository는 있지만 조회 API 없음. `SchoolClass`에는 학년도·학년·반·담임 교사가 있고 학교 ID·학교급 없음 | [SchoolClass](https://github.com/ai-sangsang-challenge-team4/Backend/blob/05611ec21baa15f638349930621d44bf868c55c5/src/main/java/com/teacherhub/school/entity/SchoolClass.java), [StudentClass](https://github.com/ai-sangsang-challenge-team4/Backend/blob/05611ec21baa15f638349930621d44bf868c55c5/src/main/java/com/teacherhub/school/entity/StudentClass.java) |
| 회원가입 자녀 정보 | `SignupRequest`는 `email`, `password`, `name`, `role`, `employeeNo`만 받음. 자녀 정보 필드 없음 | [SignupRequest](https://github.com/ai-sangsang-challenge-team4/Backend/blob/05611ec21baa15f638349930621d44bf868c55c5/src/main/java/com/teacherhub/auth/dto/SignupRequest.java) |
| 학부모·자녀 연결 | 회원가입 서비스는 학부모 계정만 생성하며 학생·학급·학부모 연결을 저장하지 않음 | [AuthService](https://github.com/ai-sangsang-challenge-team4/Backend/blob/05611ec21baa15f638349930621d44bf868c55c5/src/main/java/com/teacherhub/auth/service/AuthService.java) |
| 학생 번호 | 학생 엔티티에 문자열 `studentNo`가 있지만, 학급 내 번호인지와 학년도 변경 시의 의미는 계약 확인 필요 | [Student](https://github.com/ai-sangsang-challenge-team4/Backend/blob/05611ec21baa15f638349930621d44bf868c55c5/src/main/java/com/teacherhub/user/entity/Student.java) |

## 별도 백엔드 작업

- 학교 ID·학교명·학교급·지역을 포함한 가입 전 공개 학교 검색 API를 마련합니다. 동명 학교를 구분할 정보와 검색·페이지 처리 정책을 정해야 합니다.
- 학교·학년·학년도에 따른 실제 반 목록과 반별로 선택할 수 있는 학생 번호 조회 계약을 마련합니다. 학생 이름 등 불필요한 개인정보를 공개하지 않는 방식으로 설계해야 합니다.
- `SignupRequest`에 자녀 정보 필드를 추가하고, `studentNo`와 학급 내 학생 번호의 대응 관계 및 타입을 확정합니다.
- 현재 서버 DTO는 모든 역할에 `name`을 필수로 요구하므로, 학부모 이름을 받지 않는 요구사항에 맞춰 교사에게만 이름을 필수로 요구하도록 수정하고 이름 없는 학부모의 표시 정책을 확정해야 합니다.
- 학교·학년도·학년·반·번호·이름으로 학생을 확인하고, 학부모·학생·학급 연결을 회원가입과 함께 저장합니다. 동명이인, 잘못된 번호, 이미 연결된 학생의 처리 기준도 필요합니다.
- 학부모에만 자녀 정보를 필수로 검증하고, 자녀 정보 저장 실패 시 가입 전체를 되돌리는 트랜잭션과 오류 응답을 정의합니다.
- 확정된 계약을 기준으로 Mock 학교 목록과 인증 어댑터를 실제 API 구현으로 교체합니다. 기존 이메일 인증·로그인 계약의 연동은 별도 확인이 필요합니다.

## 검증

```bash
npm run build
npm run lint
npm run test:auth -- auth-flow.spec.ts child-signup.spec.ts
```

데스크톱·모바일에서 기존 인증 흐름과 함께 학부모 전용 표시, 계정 유형 전환, 학교급별 학년, 단계별 활성화·초기화, 검색 결과와 키보드 조작, 필수값·공백·범위 검증, 가입 실패 후 재시도, 자녀 정보의 Mock 저장, 교사 가입 시 자녀 정보 제외를 검사합니다.
