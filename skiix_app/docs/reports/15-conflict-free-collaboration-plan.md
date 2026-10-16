# Conflict-Free Collaboration Plan — Skiix Monorepo

> **Date:** June 7, 2026  
> **Repo:** `furqan137/skiix_app`  
> **Audience:** Furqan Zafar, Luthfi Alfaridz, Juan (mobile), Ashhad (product)  
> **Purpose:** Prevent merge conflicts while multiple people work on backend, frontend, and infra in parallel

---

## Executive summary

Conflicts happen when **two people change the same lines** in the same file on different branches. In a monorepo, risk is highest on **shared wiring files** (`routes.go`, `main.go`, `package-lock.json`, migrations).

**Strategy:** one integration branch, **small PRs**, **folder ownership**, **API-first contracts**, and **daily sync** — not big-bang merges.

---

## Why conflicts will happen (our situation)

| Risk | Cause |
|------|--------|
| Furqan pushed MVP on `main` while Luthfi ported Epic 2 | Same backend files (`post.go`, `routes.go`, `migration.go`) |
| Mobile + backend in one repo | FE may touch `utils/*.api.ts` while BE changes handlers |
| Direct push to `main` | Skips review; next `git pull` surprises everyone |
| Long-lived branches | `main` moves forward; feature branch diverges for days |

**What we did right:** incremental Mood Feed port, optional `moods` on posts (no FE break), Supabase auth preserved.

**What to fix going forward:** branch protection + `develop` integration branch + PR-only merges.

---

## Target git workflow

```
main          ← production-ready only (protected)
  ↑
develop       ← daily integration (everyone merges here first)
  ↑
feature/*     ← one story per branch, max 2–3 days lifespan
```

### Rules (binding)

| # | Rule |
|---|------|
| 1 | **No direct push to `main`** except release owner (Furqan) after PR approval |
| 2 | **Branch from latest `develop`** (or `main` until `develop` exists) every morning |
| 3 | **One concern per PR** — mood UI OR migration OR chat fix, not all three |
| 4 | **Rebase or merge `develop` into your branch daily** before opening PR |
| 5 | **Never force-push `main` or `develop`** |
| 6 | **Do not edit files outside your ownership** without PR comment tagging owner |

---

## Folder ownership (conflict boundaries)

| Path | Primary owner | Others may touch if… |
|------|---------------|-------------------|
| `backend/internal/delivery/http/routes.go` | Luthfi | Furqan opens PR + Luthfi reviews (high conflict) |
| `backend/cmd/skiix/main.go` | Luthfi | Same — coordinate wiring in one PR |
| `backend/pkg/migration/migration.go` | Luthfi | Append-only migrations; never rewrite old blocks |
| `backend/internal/domain/mood*.go` | Luthfi | Product tier changes need CEO ack |
| `backend/internal/delivery/http/*_handler.go` (existing) | Furqan / original author | Luthfi adds new files instead of rewriting |
| `frontend/app/`, `frontend/components/` | Juan / mobile | — |
| `frontend/utils/*.api.ts` | Juan | Backend publishes endpoint contract first |
| `frontend/.env.example` | Furqan + Luthfi | Document new vars in PR |
| `supabase/` | Furqan | — |
| `docs/adr/`, `docs/reports/` | Luthfi | Anyone for their area |
| `.github/workflows/` | Furqan + Luthfi | — |

**Principle:** add **new files** (e.g. `mood_handler.go`) instead of editing Furqan's handlers when possible.

---

## High-conflict files — handle with care

| File | Why | Mitigation |
|------|-----|------------|
| `backend/internal/delivery/http/routes.go` | Every feature registers routes | One "wiring" PR per sprint; use `RegisterXxxRoutes()` pattern |
| `backend/cmd/skiix/main.go` | DI wiring | Keep thin; register in route files only |
| `backend/pkg/migration/migration.go` | Sequential SQL | **Append only** at end; never edit prior migrations |
| `frontend/package-lock.json` | npm install churn | One person runs `npm install` per PR; others rebase |
| `backend/go.sum` | go mod tidy | Run `go mod tidy` only when deps change |

---

## API-first contract (prevents FE/BE conflict)

Before mobile implements a feature:

1. Backend merges **endpoint + Swagger** to `develop`
2. Luthfi posts **sample request/response** in PR or `docs/reports/`
3. Juan implements against **stable contract** (`GET /api/v1/moods` etc.)

| Feature | Contract doc |
|---------|----------------|
| Mood Feed | [09-mood-feed-prd-alignment.md](./09-mood-feed-prd-alignment.md) |
| Mood tiers | [13-mood-tier-ceo-decision.md](./13-mood-tier-ceo-decision.md) |
| Mobile UI | [14-mood-ui-brief-mobile.md](./14-mood-ui-brief-mobile.md) |

**Breaking API changes** require ADR or report update + mobile lead ack in PR.

---

## Implementation phases (conflict-safe)

### Phase A — Repo hygiene (Week 1) — Furqan + Luthfi

| Step | Action | Owner |
|------|--------|-------|
| A1 | Create `develop` from current `main` | Furqan |
| A2 | Enable branch protection on `main` (require PR, require CI) | Furqan |
| A3 | Announce in group: **all work → `develop` via PR** | Luthfi |
| A4 | Furqan: `git pull origin main` on local machine | Furqan |
| A5 | If Furqan has unpushed local commits → branch `furqan/local-wip`, rebase onto `main`, PR | Furqan |

### Phase B — Parallel tracks (ongoing)

```
Track 1 — Backend (Luthfi)
  develop → feature/SKX-xxx-backend
  Scope: integration tests, Epic 2 polish, bug fixes
  Avoid: rewriting Furqan's reels/chat handlers

Track 2 — Mobile (Juan)
  develop → feature/SKX-xxx-mood-ui
  Scope: mood picker, feed ?mood=, Pro lock UI
  Avoid: changing backend/ folder

Track 3 — Infra (Furqan)
  develop → feature/infra-xxx
  Scope: deploy, Firebase JSON, Supabase, CI secrets
  Avoid: large backend refactors without sync
```

### Phase C — Integration rhythm

| Cadence | Activity |
|---------|----------|
| **Daily** | `git fetch origin && git rebase origin/develop` on active branch |
| **2×/week** | 15-min sync: who touches `routes.go` / migrations this week |
| **Per PR** | CI green + 1 reviewer from affected area |
| **Weekly** | `develop` → `main` release PR when CI + smoke test pass |

---

## Step-by-step: developer daily workflow

```bash
# 1. Start of day
git fetch origin
git checkout develop
git pull origin develop

# 2. New work
git checkout -b feature/SKX-XXX-short-name

# ... code, test ...

# 3. Before PR
git fetch origin
git rebase origin/develop    # or merge develop — pick one per team, prefer rebase for linear history

# 4. Push and open PR → develop (not main)
git push -u origin feature/SKX-XXX-short-name
```

### Backend test before PR

```bash
cd backend
go test ./...
go build ./cmd/skiix/
```

### Frontend test before PR

```bash
cd frontend
npm run lint
```

---

## Furqan sync playbook (if he has local changes)

Furqan may have worked on `main` before Luthfi's merge. **Do not overwrite.**

```bash
git fetch origin
git stash                          # if uncommitted work
git checkout main
git pull origin main               # gets a443d43+ (Mood Feed, docs, CI)

git checkout -b furqan/wip-sync
git stash pop                      # if stashed

# Resolve any conflicts file-by-file
# Prefer: keep Furqan's feature logic + keep Luthfi's mood wiring

git add .
git commit -m "chore: sync local WIP with main after mood merge"
git push -u origin furqan/wip-sync
# Open PR → develop
```

**If conflicts in `routes.go`:** keep both `RegisterMoodRoutes` and Furqan's existing registrations — merge function calls, do not delete either side.

---

## Conflict resolution playbook

| Scenario | Resolution |
|----------|------------|
| `routes.go` both added routes | Keep **both** route groups; alphabetical or by feature block |
| `migration.go` both added tables | **Append** both blocks; never delete other's SQL |
| `post.go` logic differs | Discuss in PR; Furqan's mobile-facing behavior wins unless bug |
| `package-lock.json` | Accept one side, run `npm install`, commit result |
| Same mood tier definition | CEO doc [13](./13-mood-tier-ceo-decision.md) is source of truth |

**Never:** `git push --force` to shared branches.

---

## Communication templates

### WhatsApp to Furqan (after main merge)

> Main sudah ada Mood Feed + docs + CI (commit a443d43).
> Ke depan kita pakai branch `develop` + PR kecil biar ga conflict.
> Kalau ada local changes, jangan push langsung — buat branch `furqan/wip-sync` dan PR.
> Aku fokus `backend/`; kamu `frontend/` + deploy. File sensitif: routes.go, main.go — koordinasi dulu.

### PR description checklist

```markdown
## Scope
- [ ] Backend only / Frontend only / Docs only

## Conflict risk
- [ ] Touches routes.go / main.go / migration.go (yes → tag @furqan / @luthfi)

## Test plan
- [ ] go test / expo smoke / API curl

## API contract
- [ ] No breaking changes OR documented in docs/reports/
```

---

## What NOT to do (learned from this project)

| Don't | Do instead |
|-------|------------|
| Copy entire `skiix-backend` over Furqan's backend | Port feature modules incrementally |
| Big-bang merge one PR | Mood Feed first, tests second, UI third |
| Same JWT value for all env keys | Separate JWT_SECRET / SUPABASE_JWT_SECRET / service role |
| Hardcode mood list in mobile | `GET /api/v1/moods` |
| Everyone pushes to `main` | PR → `develop` → `main` weekly |

---

## Success metrics

| Metric | Target |
|--------|--------|
| PR size | < 500 lines changed (ideal < 200) |
| PR lifetime | < 3 days |
| Conflicts per merge | 0–1 file (resolved in PR, not in chat) |
| `main` CI | Always green |
| Mobile blocked on API | 0 days — contract published before UI sprint |

---

## Related documents

| Doc | Link |
|-----|------|
| Merge plan | [02-backend-merge-plan.md](./02-backend-merge-plan.md) |
| Contributing | [`CONTRIBUTING.md`](../../CONTRIBUTING.md) |
| Furqan sync | [04-furqan-sync-brief.md](./04-furqan-sync-brief.md) |
| ADR repo handoff | [../adr/003-repo-migration-handoff.md](../adr/003-repo-migration-handoff.md) |

---

## Immediate actions (this week)

| # | Action | Owner | Status |
|---|--------|-------|--------|
| 1 | Create `develop` from `main` | Furqan | 🔲 |
| 2 | Branch protection on `main` | Furqan | 🔲 |
| 3 | Furqan pull `main`, resolve local WIP via PR | Furqan | 🔲 |
| 4 | Juan: branch `feature/mood-ui` from `develop` | Juan | 🔲 |
| 5 | Luthfi: Phase 2 integration tests on `develop` | Luthfi | 🔲 |
| 6 | Share this doc in dev group | Luthfi | 🔲 |

---

*Plan version 1.0 — update after first conflict-free sprint on `develop`.*
