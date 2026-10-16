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
