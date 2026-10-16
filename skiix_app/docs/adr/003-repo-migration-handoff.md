# ADR-003: Repository Migration & Team Handoff

> **Status:** Accepted  
> **Date:** June 5, 2026  
> **Deciders:** Luthfi Alfaridz, Furqan Zafar  
> **Triggered by:** WhatsApp — consolidate FE+BE into Furqan's GitHub repo; deprecate personal repo

---

## Context

Backend development lived on `xinnxz/skiix-backend` (`feature/epic-2-completion`). The canonical monorepo is **`furqan137/skiix_app`** (FE + BE) for deployment and team access.

Risks of informal handoff:
- Lost commit history or CI configuration
- Divergent branches without merge
- Secrets shared in chat (JWT in WhatsApp — treat as compromised)
- Undocumented architecture decisions

---

## Decision

### Canonical repository

| Item | Decision |
|------|----------|
| **Target repo** | `https://github.com/furqan137/skiix_app` |
| **Source branch** | `feature/epic-2-completion` from `xinnxz/skiix-backend` |
| **Deprecation** | Personal repo archived **after** CI green on new repo — not before |

### Migration procedure

```
Step 1  Furqan creates target repo (or adds backend/ folder to existing)
Step 2  Luthfi opens PR: feature/epic-2-completion → main (target repo)
        Include: cmd/, internal/, pkg/, docs/, migrations, Dockerfile, CI
Step 3  Furqan reviews + merges
Step 4  Verify GitHub Actions: lint, test, build pass on new repo
Step 5  Update deploy secrets on hosting platform (new repo webhook)
Step 6  Rotate ALL secrets (see Security section)
Step 7  Archive xinnxz/skiix-backend with README pointer to new repo
```

### What must be transferred

| Asset | Location | Required |
|-------|----------|----------|
| Go source | `cmd/`, `internal/`, `pkg/` | ✅ |
| Migrations | `pkg/migration/` | ✅ |
| API docs | `docs/swagger.json`, Swagger UI | ✅ |
| Stakeholder reports | `docs/reports/` | ✅ |
| ADRs | `docs/adr/` | ✅ |
| CI workflow | `.github/workflows/` | ✅ |
| Env template | `.env.example` | ✅ |
| Dockerfile | root | ✅ if exists |

### Branch strategy (post-merge)

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready; protected |
| `develop` | Integration branch |
| `feature/*` | Story branches |

---

## Security — mandatory on handoff

**JWT secret was shared in WhatsApp plaintext. Treat as compromised.**

| Secret | Action |
|--------|--------|
| `JWT_SECRET` | **Rotate** — `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | **Rotate** — new value, different from access secret |
| `ADMIN_API_KEY` | Rotate if ever shared |
| `DB_PASSWORD` | Rotate on production DB |
| Firebase service account | Re-issue if JSON was shared |

**Never share production secrets in WhatsApp, Slack, or email.** Use:
- GitHub Actions secrets
- Hosting platform env (Railway, Render, Fly.io)
- 1Password / Bitwarden team vault

---

## Consequences

### Positive

- Single repo for Furqan's deploy pipeline
- Clear ownership for CI/CD and container config
- Documented handoff reduces bus factor

### Negative

- Short-term overhead for PR + CI setup
- All open PRs on old repo must be migrated or closed

---

## Sign-off

| Role | Name | Date |
|------|------|------|
| Backend Lead | Luthfi Alfaridz | 2026-06-05 |
| DevOps / Repo owner | Furqan Zafar | _pending_ |
