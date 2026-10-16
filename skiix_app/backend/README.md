# Skiix Backend (Go API)

Go 1.26 REST API for the Skiix mobile app. Lives inside the `skiix_app` monorepo.

---

## Stack

| Component | Package / path |
|-----------|----------------|
| HTTP | Gin |
| DB | PostgreSQL 16 (`lib/pq`) |
| Migrations | `pkg/migration/` |
| Mobile auth | Supabase JWT (JWKS) + legacy JWT |
| Push | Firebase Admin (optional) |
| Cache / rate limit | Redis (optional, fail-open) |
| Observability | slog, Sentry, PostHog (optional) |
| Media | Cloudinary |
| AI assist | WaveSpeed LLM |

---

## Setup

```bash
cp .env.example .env
# Required: DATABASE_URL or DB_*, SUPABASE_URL, JWT_SECRET
go mod download
go run ./cmd/skiix/
```

### Supabase connection

Prefer **Session pooler** URI in `DATABASE_URL` (IPv4-friendly):

```env
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require
SUPABASE_URL=https://<ref>.supabase.co
```

### Auth model

| Client | Token | Middleware |
|--------|-------|------------|
| Expo app | Supabase access token | `BearerAuthMiddleware` |
| Browser / legacy | Custom JWT | `JWTMiddleware` on `/auth/*` |

Protected routes under `/api/v1` accept **either** token type.

---

## Project structure

```
backend/
├── cmd/skiix/           Entry point
├── internal/
│   ├── delivery/http/   Handlers, routes, middleware
│   ├── domain/          Entities and interfaces
│   ├── usecase/         Business logic
│   ├── repository/      PostgreSQL adapters
│   └── infrastructure/  JWT, Supabase, Firebase, Cloudinary
├── pkg/migration/       Schema migrations
└── docs/                Swagger (swagger.json, swagger.yaml)
```

---

## API docs

With server running:

- Swagger UI: `http://localhost:8080/swagger/index.html`
- Redirect: `http://localhost:8080/docs`

Regenerate after handler changes:

```bash
swag init -g cmd/skiix/main.go -o docs
```

---

## Testing

```bash
# Unit tests
go test -v -race ./...

# Integration tests (requires Postgres 16)
TEST_DATABASE_URL=postgres://skiix:skiix@localhost:5432/skiix_test?sslmode=disable \
  go test -v -tags=integration ./internal/repository/...
```

---

## Key endpoints

| Area | Prefix |
|------|--------|
| Health | `GET /health` |
| Legacy auth | `/auth/register`, `/auth/login` |
| OTP (Expo) | `POST /api/v1/auth/send-otp` |
| Posts & feed | `/api/v1/posts`, `/api/v1/feed?mood=` |
| Moods | `/api/v1/moods` |
| Waitlist | `POST /api/v1/waitlist` |
| Notifications | `/api/v1/notifications` |
| Search | `/api/v1/search`, `/api/v1/search/trending/*` |
| Devices | `/api/v1/devices/register`, `/api/v1/devices/quiet-hours` |
| Circles | `/api/v1/circles` |
| Messaging | `/api/v1/conversations`, `/api/v1/ws/messaging` |
| Chat token | `/api/v1/chat/auth-token` |
| Upload | `/api/v1/upload` |

Canonical repo: [furqan137/skiix_app](https://github.com/furqan137/skiix_app). Standalone `xinnxz/skiix-backend` is archived reference only.

---

## Module path

Go module: `github.com/skiix-backend` (historical name; may rename to `github.com/furqan137/skiix_app/backend` in a future ADR).
