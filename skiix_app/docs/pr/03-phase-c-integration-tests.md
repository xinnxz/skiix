# PR: Phase C — Integration tests

**Base:** `develop` (after Phase A + B merged, or stack on `feature/SKX-epic2-features`)  
**Head:** `feature/SKX-integration-tests`  
**Create:** https://github.com/furqan137/skiix_app/compare/develop...feature/SKX-integration-tests

## Title

`test(backend): repository integration tests and CI Postgres`

## Summary

- Port integration test harness with monorepo table truncate list
- Add tests: circle, mood feed/pro, waitlist, user, feed privacy, search privacy, followers, index audit
- CI: Postgres 16 service + `go test -tags=integration ./internal/repository/...`

## Skipped (ADR-005)

Standalone `user_follows`, `post_bookmarks`, Epic 2 social tests — not applicable to Furqan schema.

## Test plan

- [x] `go test ./...` (unit)
- [ ] `TEST_DATABASE_URL=... go test -tags=integration ./internal/repository/...`
- [ ] CI green on PR
