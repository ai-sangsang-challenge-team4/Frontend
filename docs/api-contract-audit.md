# 배포 Swagger API 계약 점검 (2026-11-17)

공개 요청·응답 형식은 [배포 Swagger](https://teacherhub.duckdns.org/swagger-ui/index.html)와 `/v3/api-docs`를 기준으로 비교했습니다. 상태 전환과 AI 비동기 처리 의미는 [Backend dev](https://github.com/ai-sangsang-challenge-team4/Backend/tree/b38e2452af52abb17cc7344c42037687d71b6273), [AI dev](https://github.com/ai-sangsang-challenge-team4/AI/tree/ee08ba15e90594280d8d20dc51fb32f920ec56d4)를 함께 확인했습니다.

## 범위와 결과

Swagger의 54개 API 중 화면에서 사용하는 53개의 경로·메서드가 일치합니다. `GET /health`는 서비스 상태 점검용으로 화면에 연결하지 않습니다. 인증·회원가입 선택 목록, 학부모 문의·분석·전송, 교사 메시지·답변·템플릿, 위험도 검토·관리자 공유·긴급 재검토의 요청 본문·쿼리·응답 필드도 비교했습니다. 교사 답변의 `Idempotency-Key`, 학부모 추가 문의의 `expectedContentVersion` 전송은 기존 구현이 계약과 일치합니다.

| 발견한 차이 | 반영한 처리 |
| --- | --- |
| 학부모 본문을 1500자로 제한 | 최초·추가 문의를 5000자로 조정. 교사 답변은 1500자 유지 |
| 회원가입 비밀번호를 20자로 제한, 이름 길이 검증 일부 누락 | 비밀번호 8~100자, 본인 이름 100자, 자녀 이름 50자, 교번 100자 적용 |
| 상향 위험도 변경에 사유 없이 제출 가능 | Backend가 요구하는 상향·하향 모두 사유 필수 적용. 같은 점수 유지는 선택 |
| 분석 후 비동기 수정안 상태 누락 | `revisionStatus` 4종 지원. 준비 중이면 같은 분석의 findings를 제한적으로 재조회하고 실패 시 재시도 제공 |
| 교사 요약 실패를 일반 메시지·요약 완료로 해석 | `summaryStatus=UNAVAILABLE`을 실패 안내 카드로 표시하고 기존 원문 열람 절차 유지 |
| 교사 대화의 읽음 상태 누락 | `status=READ`·`readAt`을 학부모 읽음 표시에 반영 |
| 신규 처리 이력 4종 표시명 누락 | AI 분석 제한·규칙 폴백·AI 초안 정책 차단·답변 정책 차단의 한국어 작업명 추가 |
| 수정된 `/users/me`의 과거 500 임시 우회 잔존 | 저장된 JWT로 조회 성공을 대신하지 않고 오류·재시도 처리 |

AI 서비스는 Backend 내부에서 호출합니다. 프론트에 AI 서버 직접 호출을 추가하지 않았습니다. AI의 태그·판정 상태·심각도 0~3·반복 횟수·안전 신호는 기존 프론트 계약과 일치했습니다. 시스템 위험 점수(0~100), 교사 검토(1~7), 권한·안전 잠금·전송 정책은 유지합니다.

주요 구현 근거는 Backend의 `TeacherRiskReviewService`, `RiskRevisionService`, `RiskRevisionResponse`, `TeacherComplaintQueryService`, `BufferedSummaryService`, `UserController`와 AI의 `app/schemas/ai.py`, `revision.py`, `support.py`입니다.

## 검증

- `tests/fixtures/swagger-api-surface.json`: 점검 시점의 공개 경로·메서드 54개. `swagger-api-surface.spec.ts`가 실제 HTTP 어댑터의 모든 호출을 이 목록과 비교합니다.
- 입력 경계, 수정안 상태와 위험 근거 보존, 신규 이력 표시, 요약 실패·읽음 변환을 API·모델 테스트로 확인합니다.
- HTTP 화면 테스트는 비동기 수정안 도착 전 원문 편집 보존, 동일 분석 재조회, 요약 실패 시 원문 미노출, 사용자 조회 실패 후 재시도를 확인합니다.
- HTTP 테스트는 Swagger·Backend 계약에 따른 응답을 가로채 실행합니다. 실제 배포 서버에서 메시지를 전송하거나 AI 생성을 실행한 검증과 구분합니다.

| 최종 검증 | 결과 |
| --- | --- |
| 학부모 HTTP | 96건 통과 |
| 관리자 HTTP | 14건 통과 |
| 인증·교사·관리자 HTTP 통합 | 12건 통과 |
| 인증·화면 전체 회귀 | 530건 통과, desktop/mobile |
| build·lint·앱/테스트 TypeScript·diff 검사 | 통과. 기존 Vite 500kB 청크 안내 유지 |
| gstack 모바일 화면 확인 | 학부모 본문 `maxLength=5000`, 가로 넘침 없음 |

PR 생성 전 최종 실행에서 **총 652건이 모두 통과**했습니다. 사전 점검에서는 저장된 상향 사유가 남아 있는데 하향 버튼의 비활성을 기대하는 테스트 오류를 발견했습니다. 저장된 사유를 확인하고 비운 뒤 필수 조건을 검사하도록 테스트를 수정했습니다. 관리자 승인 대기 표시 검사도 사전 실행에서 한 번 실패했으나, 관련 80건 재검증과 최종 전체 실행에서는 통과했습니다. 해당 관리자 기능·안전 정책 코드는 변경하지 않았습니다.

최초 문의의 `임시저장`은 기존처럼 브라우저 저장이며 서버 초안은 분석 시작 시 생성합니다. 학부모 목록 검색의 로컬 처리, 서버 API가 없는 별표·지정 담당자 요청 같은 기능은 이번 API 계약 정렬 범위에서 변경하지 않았습니다.


## 2026-11-22 추가 점검 (#93, #95)

최신 배포 Swagger는 59개 API입니다. 대응 기록 패키지 3개를 추가 연결하여 화면용 58개의 HTTP 어댑터 경로·메서드가 일치하며, `GET /health`만 화면에서 제외합니다. 계약 테스트 fixture도 최신 목록으로 갱신했습니다. 이전 목록에 대한 통과 결과를 현재 서버 전체의 연동 증거로 사용하지 않습니다.

RAG `references`와 `legalCitationWarning`의 화면 반영 및 패키지 생성·조회·인증 다운로드를 추가했습니다. 자세한 계약과 제한은 [증빙 패키지 연동](teacher-mediation-package.md)을 참고하세요. 이 검증은 실제 사용자 민원을 생성·전송한 운영 검증과 구분합니다.
