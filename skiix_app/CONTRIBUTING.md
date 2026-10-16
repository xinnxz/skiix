# Contributing to Skiix App

Thank you for contributing to the Skiix monorepo. This guide keeps changes reviewable and deploy-safe.

---

## Getting started

1. Clone `https://github.com/furqan137/skiix_app.git`
2. Copy env templates: `backend/.env.example`, `frontend/.env.example`
3. Install dependencies (`go mod download`, `npm install` in `frontend/`)
4. Create a feature branch: `git checkout -b feature/SKX-XXX-short-description`

---

## Branch naming

```
feature/SKX-712-mood-feed
fix/SKX-201-circle-auth
docs/adr-supabase-auth
chore/ci-backend
```

---

## Commit messages

Use conventional commits:

```
feat(mood): add catalog endpoint SKX-712
fix(auth): require token on circle mutations SKX-201
docs(reports): update merge plan phase 2
chore(ci): add monorepo backend workflow
```

One logical change per commit when possible.

---

## Pull requests

Every PR should include:

1. **Summary** — what and why (1–3 bullets)
2. **Test plan** — commands run, manual steps
3. **Breaking changes** — API or env var changes
4. **Screenshots** — for frontend UI changes

### Review checklist (author)

- [ ] `make backend-test` passes locally (or equivalent `go test`)
- [ ] No secrets in diff
- [ ] Swagger updated if API changed (`backend/docs/`)
- [ ] ADR linked if architecture decision changed

---

## Code ownership

| Area | Primary |
|------|---------|
| `backend/` Go API | Luthfi Alfaridz |
| `frontend/` Expo app | Mobile / FE team |
| `supabase/` | Furqan Zafar |
| `docs/adr/` | Backend + DevOps |

---

## Environment variables

| Location | Template |
|----------|----------|
| Backend | `backend/.env.example` |
| Frontend | `frontend/.env.example` |
| Supabase functions | `supabase/.env.example` |

Do not rename env vars without updating all three templates and the deployment checklist.

---

## Running checks locally

```bash
# From repo root
make backend-lint
make backend-test
make backend-build

# Frontend
cd frontend && npm run lint
```

---

## Questions

- Architecture: see `docs/adr/`
- Merge scope: see `docs/reports/02-backend-merge-plan.md`
- Deploy: see `docs/reports/05-deployment-checklist.md`
