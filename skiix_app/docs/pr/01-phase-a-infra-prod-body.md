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
