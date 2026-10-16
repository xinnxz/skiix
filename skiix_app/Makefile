# Skiix monorepo — common dev commands
# Usage: make backend-test, make help

BACKEND_DIR := backend
GO := go -C $(BACKEND_DIR)

.PHONY: help backend-deps backend-lint backend-test backend-build backend-run frontend-install frontend-lint

help:
	@echo "Skiix monorepo targets:"
	@echo "  make backend-deps     Download Go modules"
	@echo "  make backend-lint     Run golangci-lint (requires golangci-lint installed)"
	@echo "  make backend-test     Run unit tests"
	@echo "  make backend-build    Compile API binary"
	@echo "  make backend-run      Start API server"
	@echo "  make frontend-install npm install in frontend/"
	@echo "  make frontend-lint    Expo lint"

backend-deps:
	$(GO) mod download

backend-lint:
	cd $(BACKEND_DIR) && golangci-lint run --timeout=5m

backend-test:
	$(GO) test -v -race ./...

backend-build:
	cd $(BACKEND_DIR) && CGO_ENABLED=0 go build -o bin/skiix ./cmd/skiix/

backend-run:
	$(GO) run ./cmd/skiix/

frontend-install:
	cd frontend && npm install

frontend-lint:
	cd frontend && npm run lint
