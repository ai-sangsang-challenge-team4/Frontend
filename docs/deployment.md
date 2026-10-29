# Vercel 배포

`vercel.json`이 두 가지를 합니다.

| rewrite | 이유 |
| --- | --- |
| `/api/:path*` → `https://teacherhub.duckdns.org/:path*` | 로컬 개발(Vite 프록시)과 같은 `VITE_API_BASE_URL=/api`로 백엔드를 부릅니다. 브라우저 입장에서는 같은 출처라 CORS 사전 요청이 없습니다 |
| 그 외 전부 → `/index.html` | React Router 화면(`/login`, `/teacher/messages/2` 등)을 직접 열거나 새로고침해도 404가 나지 않게 합니다. 정적 파일(`/assets/*`)은 rewrite보다 먼저 제공됩니다 |

2026-10-29 확인: `vercel.json`이 없어 배포본에서 `/login`, `/teacher/messages`를 직접 열면 404였고 `/api/*`도 404였습니다.

## 백엔드 주소

- 배포 백엔드는 HTTPS입니다(Let's Encrypt, `http://`는 301로 `https://`에 리다이렉트). 그래서 Vercel(HTTPS)에서 불러도 Mixed Content 문제는 없습니다.
- 백엔드 CORS는 `https://teacherhub-bay.vercel.app`만 허용합니다. rewrite로 보낸 요청에도 브라우저의 `Origin`이 그대로 전달될 수 있어, **Vercel Preview 배포(다른 도메인)에서는 POST 등이 403**일 수 있습니다. 프로덕션 도메인으로 확인하거나, 백엔드에 Preview Origin 허용을 요청해야 합니다.
- 백엔드 주소가 바뀌면 `vercel.json`의 `destination`을 고칩니다.

## Vercel 환경 변수

| 변수 | 값 |
| --- | --- |
| `VITE_API_BASE_URL` | `/api` (기본값과 같아 생략 가능) |
| `VITE_AUTH_API`, `VITE_MESSAGE_API`, `VITE_ESCALATION_API` | 서버로 시연하려면 `http`, mock 시연이면 생략 |

Vite 환경 변수는 빌드할 때 들어가므로, 바꾼 뒤에는 다시 배포해야 합니다.
