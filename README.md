# NexDesk Web

Web client for **NexDesk**, a multi-tenant help desk and SLA management SaaS. The API lives in
[nexdesk-api](https://github.com/mahmoudadel810/nexdesk-api).

## Tech stack

| Area | Choice |
|------|--------|
| Framework | Angular 22 — standalone components, signals, zoneless change detection |
| UI | Angular Material (M3) with a custom theme, light and dark mode |
| i18n | Transloco — English and Arabic, with full right-to-left layout switching |
| Tests | Vitest via the Angular unit-test builder |
| Lint / format | ESLint (angular-eslint), Prettier |

## Quick start

Prerequisites: Node.js 24 (or 22.22.3+), and the API running on `http://localhost:8080`
(see the [API quick start](https://github.com/mahmoudadel810/nexdesk-api#quick-start)).

```bash
npm ci
npm start
```

Open http://localhost:4200. The dev server proxies `/api` and `/hubs` to the API using
`proxy.conf.json`; change the `target` there if your API runs elsewhere.

### API URL per environment

`src/environments/environment.ts` (production) and `environment.development.ts` hold `apiUrl`
and `hubUrl`. Both default to relative paths, so the same build works behind any reverse proxy.

### Running in Docker next to the API stack

With the API's `docker compose up` already running:

```bash
docker build -t nexdesk-web .
docker run --rm -p 4200:80 --network nexdesk_default nexdesk-web
```

The container's nginx serves the app and forwards `/api`, `/hubs` and the API reference (`/docs`,
`/openapi`) to `API_UPSTREAM`
(default `http://api:8080`, the API service name on the compose network).

## Scripts

| Command | Purpose |
|---------|---------|
| `npm start` | Dev server with API proxy |
| `npm run lint` | ESLint over TypeScript and templates |
| `npm run format:check` | Prettier check |
| `npm test` | Unit tests (single run) |
| `npm run build` | Production build into `dist/` |
| `scripts/verify.sh` | Lint, format check, tests and build in one go; run before merging |
