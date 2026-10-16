# Skiix App — Monorepo

> **Canonical repository** for Skiix mobile MVP: Expo frontend, Go API backend, Supabase project config.  
> **Owner:** Furqan Zafar · **Backend lead:** Luthfi Alfaridz (xinnxz)

---

## Repository layout

```
skiix_app/
├── frontend/          Expo 54 + React Native (Supabase Auth)
├── backend/           Go 1.26 API (Gin, PostgreSQL, Firebase)
├── supabase/          Edge functions + local Supabase config
└── docs/              ADRs, merge plans, stakeholder reports
```

---

## Quick start

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20+ |
| Go | 1.26.1 |
| PostgreSQL | 16 (or Supabase project) |
| Expo CLI | via `npx expo` |

### 1. Backend

```bash
cd backend
cp .env.example .env          # fill DATABASE_URL, SUPABASE_*, JWT_SECRET
go mod download
go run ./cmd/skiix/
```

API: `http://localhost:8080` · Swagger: `http://localhost:8080/swagger/index.html`

### 2. Frontend (Expo)

```bash
cd frontend
cp .env.example .env          # EXPO_PUBLIC_SUPABASE_*, API base URL
npm install
npx expo start
```

Use emulator or physical device on the same Wi‑Fi; point API to your PC LAN IP (`:8080`).

### 3. Supabase (optional local)

```bash
cd supabase
cp .env.example .env
supabase start                # requires Supabase CLI
```

---

## Architecture (current)

| Layer | Technology | Notes |
|-------|------------|-------|
| Mobile auth | **Supabase Auth** | Primary for Expo app |
| API auth | Supabase JWT (JWKS) + legacy JWT | `BearerAuthMiddleware` |
| Database | PostgreSQL 16 | Supabase pooler or local |
| Real-time chat | WebSocket + Firebase RTDB | See [ADR-001](docs/adr/001-chat-firebase-vs-postgres.md) |
| Push | Firebase FCM | Optional via `FIREBASE_CREDENTIALS_PATH` |
| Media | Cloudinary | Backend upload proxy |

See [docs/adr/](docs/adr/README.md) for binding decisions.

---

## Branch strategy (post–Mood Feed merge)

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready; **PR only** (protected) |
| `develop` | Daily integration — **branch from here** |
| `feature/*` | One story per branch; merge to `develop` first |

Full conflict-avoidance workflow: [docs/reports/15-conflict-free-collaboration-plan.md](docs/reports/15-conflict-free-collaboration-plan.md).

---

## Backend merge status

Epic 2 work from `xinnxz/skiix-backend` (`feature/epic-2-completion`) is being ported into `backend/`.

| Feature | Monorepo status |
|---------|-----------------|
| Supabase Auth + dual JWT | ✅ Present |
| Posts, circles, focus mode | ✅ Present |
| Reels, stories, WebSocket chat | ✅ Furqan MVP |
| **Mood Feed (PRD-12)** | 🔲 Planned — [merge plan](docs/reports/02-backend-merge-plan.md) |
| Integration tests (14+) | 🔲 Planned |
| ADRs + deploy checklist | ✅ In `docs/` |

---

## Security

- **Never commit** `.env` files or Firebase service account JSON.
- Rotate `JWT_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` if ever shared in chat.
- See [docs/reports/03-security-secret-rotation.md](docs/reports/03-security-secret-rotation.md).

---

## Links

| Resource | Path |
|----------|------|
| Backend README | [backend/README.md](backend/README.md) |
| Merge plan | [docs/reports/02-backend-merge-plan.md](docs/reports/02-backend-merge-plan.md) |
| Furqan sync brief | [docs/reports/04-furqan-sync-brief.md](docs/reports/04-furqan-sync-brief.md) |
| ADR index | [docs/adr/README.md](docs/adr/README.md) |

---

*Last updated: June 5, 2026*
