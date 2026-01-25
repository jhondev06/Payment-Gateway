# Changelog

All notable changes to the Payment Gateway project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-01-25

### Added
- **Security** (Hardening Phase 2)
  - TLS/HTTPS support with Let's Encrypt via Caddy reverse proxy
  - Docker secrets management for all sensitive credentials
  - Webhook signature validation (HMAC SHA-256) for Mercado Pago
  - Security headers (HSTS, X-Frame-Options, CSP, etc.)
  - Secrets validation on service startup

- **Resilience** (Hardening Phase 2)
  - Circuit Breaker implementation (Opossum) for Mercado Pago provider
  - Exponential backoff retry for RabbitMQ consumers (notification and email services)
  - Dead Letter Queue (DLQ) support for failed messages
  - Health check integration in `/health/ready` endpoint

- **Observability** (Hardening Phase 2)
  - Prometheus metrics collection:
    - Counters: `payments_created_total`, `payments_completed_total`, `payments_failed_total`, `http_requests_total`
    - Histograms: `payment_processing_duration_seconds`, `http_request_duration_seconds`
    - Gauges: `active_connections`, `queue_length`, `circuit_breaker_state`
  - Metrics endpoint `/health/metrics` exposed
  - Structured logging maintained

- **Alerting** (Hardening Phase 2)
  - Slack webhook integration for real-time alerts
  - Alert levels: CRITICAL, ERROR, WARNING, INFO
  - Alert service with automatic error notification

- **Operations** (Hardening Phase 2)
  - Automated daily database backups (2:00 AM) via pg_dump
  - Backup retention policy (7 days)
  - Backup integrity validation
  - Restore script for disaster recovery
  - Backup logs for audit trail

- **Testing** (Hardening Phase 2)
  - 42 unit tests created (100% passing)
  - 9 E2E integration tests created
  - Test coverage increased to ~60%
  - Integration test suite with Testcontainers
  - Jest integration configuration for E2E tests

### Changed
- **Infrastructure**
  - Updated `docker-compose.yml` to use Docker secrets
  - Added Caddy service for HTTPS termination
  - Added backup service with scheduled jobs
  - Removed hardcoded credentials from docker-compose.yml
  - Updated port exposures (only HTTPS port 443 exposed externally)
  - Added health checks to all services

- **Services**
  - API Gateway: Secrets validation, improved error handling
  - Payment Service: Body parser for raw webhook payload, circuit breaker integration
  - Notification Service: Exponential backoff retry mechanism
  - Email Service: Exponential backoff retry mechanism

### Fixed
- Security vulnerability: Webhooks were accepted without signature validation
- Missing retry logic in RabbitMQ consumers (now has exponential backoff)
- No circuit breaker for external provider calls (now uses Opossum)
- No backup automation (now has scheduled daily backups)

### Documentation
- Added `secrets/README.md` - Guide for secrets management
- Added `infra/backup/README.md` - Backup and restore documentation
- Added `FASE2_COMPLETA.md` - Complete Phase 2 implementation summary
- Updated `ROADMAP.md` - Phase 2 marked as complete
- Updated `.env.example` - Added new environment variables (CADDY_DOMAIN, SLACK_WEBHOOK_URL)
- Updated `package.json` - Added `test:e2e` script

### Performance
- Improved connection handling with circuit breaker (fast fail on provider unavailability)
- Optimized retry attempts with exponential backoff (reduces load on failing services)
- Added Prometheus metrics for performance monitoring

### Dependency Updates
- Added `opossum` (Circuit Breaker)
- Added `prom-client` (Prometheus metrics)
- Added `@nestjs/testing@10.x` (Testing framework)
- Added `@types/pg` (PostgreSQL types)

---

## [1.0.0] - 2025-12-22

### Added
- MVP implementation complete
- PIX payment creation via Mercado Pago
- Idempotency handling (Redis + PostgreSQL)
- Webhook processing
- Event publishing (RabbitMQ)
- Structured JSON logging
- Health check endpoints
- Sandbox testing endpoints
- Developer documentation

### Architecture
- Event-driven architecture with RabbitMQ
- Microservices: API Gateway, Payment Service, Notification Service, Email Service
- PostgreSQL as source of truth
- Redis for caching and rate limiting
- Mercado Pago integration for PIX payments

---

## Version Format
- **[MAJOR.MINOR.PATCH]**
  - MAJOR: Breaking changes
  - MINOR: New features (backwards compatible)
  - PATCH: Bug fixes (backwards compatible)

## How to Update This Changelog
1. Add a new section under `[Unreleased]`
2. Move section to a version when released
3. Follow the format: Added, Changed, Deprecated, Removed, Fixed, Security

## Links
- [GitHub Repository](https://github.com/jhondev06/Payment-Gateway)
- [Issues](https://github.com/jhondev06/Payment-Gateway/issues)
