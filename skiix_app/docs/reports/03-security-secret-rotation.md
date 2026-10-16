# Security Notice — Secret Rotation Required

> **Date:** June 5, 2026  
> **Severity:** High  
> **Status:** Action required before production deploy  
> **Audience:** Furqan Zafar, Luthfi Alfaridz, anyone with deploy access

---

## Incident

Production-oriented `JWT_SECRET` value was shared in a **WhatsApp group chat** during infrastructure planning.

Even if the message was later deleted, assume the value is **compromised**.

---

## Required actions

| Secret | Action | How to generate |
|--------|--------|-----------------|
| `JWT_SECRET` | **Rotate immediately** | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | **Rotate** (must differ from access secret) | `openssl rand -hex 32` |
| `ADMIN_API_KEY` | Rotate if ever shared | `openssl rand -hex 24` |
| `DB_PASSWORD` | Rotate on production DB before go-live | Provider dashboard |

---

## Storage rules (going forward)

| ✅ Do | ❌ Don't |
|-------|---------|
| GitHub Actions encrypted secrets | WhatsApp / Telegram |
| Hosting platform env (Railway, Render, Fly) | Notion public pages |
| Team password manager (1Password, Bitwarden) | Screenshot in chat |
| `.env` locally (gitignored) | Commit `.env` to git |

---

## Impact of rotation

- All existing access + refresh tokens become **invalid**
- Users must log in again (acceptable pre-beta)
- No code changes required — only env update + redeploy

---

## Verification after rotation

1. Deploy with new secrets
2. `POST /auth/login` → returns new tokens
3. Old tokens → `401 Unauthorized`
4. Confirm no secret values in git history: `git log -p | grep -i jwt_secret` (should only show placeholders)

---

## Reference

- [ADR-003](../adr/003-repo-migration-handoff.md) — Security section
- [10-deployment-checklist.md](./10-deployment-checklist.md) — Pre-deploy secrets

---

*Resolve this checklist item before marking production deploy as complete.*
