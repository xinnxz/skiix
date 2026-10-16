# Pull Request Playbook — Backend Sync (Jun 2026)

> **Repo:** [furqan137/skiix_app](https://github.com/furqan137/skiix_app)  
> **Target branch:** `develop`  
> **Rule:** Merge **in order** — do not skip. Each PR is reviewable on its own.

---

## Merge order

```
develop
   ↑  PR #1  feature/SKX-infra-prod
   ↑  PR #2  feature/SKX-epic2-features   (merge after #1)
   ↑  PR #3  feature/SKX-integration-tests (merge after #2)
```

| # | Branch | Scope | Est. review |
|---|--------|-------|-------------|
| 1 | `feature/SKX-infra-prod` | Redis, middleware, health, docs | ~30 min |
| 2 | `feature/SKX-epic2-features` | Waitlist, notifications, search, quiet hours | ~45 min |
| 3 | `feature/SKX-integration-tests` | Integration tests + CI Postgres | ~20 min |

**Note:** Before PR #1 merges, PR #2 may show 2 commits (includes Phase A). After #1 merges, GitHub refreshes #2 to show only Phase B commits.

---

## How to open each PR (2 minutes each)

1. Click the **Create pull request** link below.
2. Set **base** = `develop`, **compare** = feature branch (pre-filled).
3. Paste **title** and **body** from the sections below (exact copy).
4. Add labels: `backend` (+ `documentation` for PR #1).
5. Request review: **Furqan Zafar** (repo owner).
6. Wait for CI green before merge.
7. Use **Squash and merge** or **Merge commit** — team preference; keep commit messages readable.

---

## PR #1 — Phase A production foundation

**Open:** https://github.com/furqan137/skiix_app/compare/develop...feature/SKX-infra-prod?expand=1

**Title:**
```
feat(backend): Phase A production foundation
```

**Body (paste everything below the line):**

---

## Summary

- Port Redis client and global/auth rate limiting (fail-open when Redis unavailable)
- Add structured logging, CORS, security headers, request ID, optional Sentry/PostHog
- Add `GET /health` with DB ping and graceful HTTP shutdown
- Document ADR-005 reconciliation decisions and backend sync gap analysis

## Test plan

- [x] `go test ./...`
- [x] `go build ./cmd/skiix/`
- [ ] `curl http://localhost:8080/health`
- [ ] Expo smoke: login + feed still works

## Breaking changes

None — additive middleware and wiring only.

---

## PR #2 — Epic 2 features

**Open:** https://github.com/furqan137/skiix_app/compare/develop...feature/SKX-epic2-features?expand=1

**Merge after:** PR #1 is merged to `develop`.

**Title:**
```
feat(backend): Epic 2 waitlist, notifications, search, quiet hours
```

**Body:**

---

## Summary

- Waitlist API (`POST /api/v1/waitlist`) with hourly rate limit + optional Resend audience sync
- In-app notifications APIs under `/api/v1/notifications/*` (Bearer auth)
- Search + trending under `/api/v1/search/*`
- Push quiet hours on `/api/v1/devices/quiet-hours`; FCM suppressed during quiet window

## Depends on

Phase A (`feature/SKX-infra-prod`) — Redis + production middleware.

## Test plan

- [x] `go test ./...`
- [x] `go build ./cmd/skiix/`
- [ ] `POST /api/v1/waitlist` with `consent_given: true`
- [ ] `GET /api/v1/notifications` with Supabase bearer
- [ ] `PUT /api/v1/devices/quiet-hours`

## Breaking changes

None — new routes and append-only migrations only.

---

## PR #3 — Integration tests

**Open:** https://github.com/furqan137/skiix_app/compare/develop...feature/SKX-integration-tests?expand=1

**Merge after:** PR #2 is merged to `develop`.

**Title:**
```
test(backend): repository integration tests and CI Postgres
```

**Body:**

---

## Summary

- Integration test harness adapted for monorepo schema (`followers`, `saves` — not Epic 2 `user_follows`)
- Tests: circle, mood feed/pro, waitlist, user, feed privacy, search privacy, followers, index audit
- CI: Postgres 16 service + `go test -tags=integration ./internal/repository/...`

## Skipped (ADR-005)

Standalone `user_follows`, `post_bookmarks`, Epic 2 social tests — not applicable to Furqan mobile schema.

## Test plan

- [x] `go test ./...` (unit)
- [ ] CI integration job green on this PR
- [ ] Optional local: `TEST_DATABASE_URL=... go test -tags=integration ./internal/repository/...`

## Breaking changes

None.

---

## PR #4 — Release `develop` → `main` (after #1–#3 merged)

**Open:** https://github.com/furqan137/skiix_app/compare/main...develop?expand=1

**Title:**
```
release: sync develop backend (Epic 2 port Phases A–C)
```

**Body:** paste `docs/pr/04-release-develop-to-main-body.md`

**Merge when:** CI green + Furqan approval. This makes `main` the production branch for mobile/deploy.

---

## After release PR merges

- [ ] Furqan: `git pull origin main`, run Expo smoke test
- [ ] Juan: Mood Feed UI (doc 14)
- [ ] Archive `xinnxz/skiix-backend` on GitHub (README pointer done)
- [ ] See [17-post-sync-status.md](../reports/17-post-sync-status.md)

---

## Optional: `gh` CLI (one-time setup)

```powershell
winget install GitHub.cli
gh auth login
```

Then from repo root:

```powershell
gh pr create --base develop --head feature/SKX-infra-prod --title "feat(backend): Phase A production foundation" --body-file docs/pr/01-phase-a-infra-prod-body.md
```

(Body files without front-matter are in this folder.)
