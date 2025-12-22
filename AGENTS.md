# AI Agent Guidelines

This document provides comprehensive instructions for AI agents (LLMs, coding assistants) working with the Payment Gateway codebase.

---

## Project Overview

- **Type**: Payment Gateway MVP (PIX-first)
- **Stack**: NestJS + TypeScript + PostgreSQL + Redis + RabbitMQ
- **Architecture**: Event-driven, microservices-ready monorepo
- **Language**: Code in English, comments in Portuguese (Brazilian Portuguese)

---

## Directory Structure

```
gateway/
├── api-gateway/           # HTTP proxy, auth, rate limiting
├── payment-service/       # Core payment logic (main service)
├── notification-service/  # WebSocket notifications
├── email-service/         # Email delivery
└── infra/postgres/        # Database schema
```

**Primary working directory**: `payment-service/`

---

## Critical Constraints

### DO NOT

1. **Never modify `.env` file** - It contains secrets and is gitignored
2. **Never hardcode credentials** - Always use environment variables
3. **Never remove idempotency checks** - They prevent duplicate payments
4. **Never skip error handling** - All external calls must have try-catch
5. **Never use `any` type** - Use proper TypeScript interfaces
6. **Never commit node_modules** - Already in .gitignore

### ALWAYS

1. **Use Portuguese for comments and logs** - Target audience is Brazilian developers
2. **Follow existing patterns** - Check similar files before creating new ones
3. **Run tests after changes** - `npm test` in payment-service/
4. **Maintain idempotency** - Every payment operation must be idempotent
5. **Log with context** - Use the Logger class with structured JSON output
6. **Type everything** - No implicit any, define interfaces

---

## Code Style

### File Naming
- Controllers: `*.controller.ts`
- Services: `*.service.ts`
- Repositories: `*.repository.ts`
- DTOs: `*.dto.ts`
- Tests: `*.spec.ts`
- Modules: `*.module.ts`

### Import Order
1. NestJS/Node modules
2. Third-party libraries
3. Internal modules (relative imports)

### Comments
- Use JSDoc style for public methods
- Write in Portuguese
- Include parameter descriptions for complex functions

---

## Key Patterns

### Dependency Injection

All services use NestJS DI. Never instantiate services directly:

```typescript
// CORRECT
constructor(private readonly paymentService: PaymentService) {}

// WRONG
const service = new PaymentService();
```

### Error Handling

Always wrap external calls:

```typescript
try {
    const result = await this.externalService.call();
    return result;
} catch (error) {
    this.logger.error('Descriptive message', error);
    throw error; // or handle gracefully
}
```

### Idempotency

Every payment creation must check idempotency first:

```typescript
const cached = await this.idempotencyService.get(key);
if (cached) return cached;

// ... create payment
await this.idempotencyService.set(key, payment);
```

### Event Publishing

Events are published after successful DB operations:

```typescript
// 1. Save to DB (inside transaction)
await this.repository.save(entity);

// 2. Publish event (outside transaction - fire and forget)
await this.eventPublisher.publish('exchange', event);
```

---

## Common Tasks

### Adding a New Endpoint

1. Add DTO in `payment.dto.ts`
2. Add method in `payment.service.ts`
3. Add route in `payment.controller.ts`
4. Add tests in `payment.service.spec.ts`

### Adding a New Payment Method

1. Create provider in `infra/<provider>/`
2. Add to `InfraModule` as provider
3. Inject in `PaymentService`
4. Add new status types if needed

### Modifying Database Schema

1. Update `infra/postgres/init.sql`
2. Update interfaces in `payment.dto.ts`
3. Update `payment.repository.ts`

---

## Testing

### Running Tests

```bash
cd payment-service
npm test                    # Run all tests
npm test -- --watch         # Watch mode
npm test -- --coverage      # With coverage
```

### Writing Tests

- Use Jest with mocks for external dependencies
- Follow existing test structure in `*.spec.ts` files
- Mock all infrastructure services (DB, Redis, RabbitMQ)

---

## Troubleshooting

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `ECONNREFUSED` PostgreSQL | Container not running | `docker-compose up -d postgres` |
| `ECONNREFUSED` Redis | Container not running | `docker-compose up -d redis` |
| `Module not found` | Dependencies not installed | `npm install` |
| `Idempotency-Key required` | Missing header | Add `Idempotency-Key: <uuid>` header |

### Debug Mode

Set environment variable:
```
LOG_LEVEL=debug
```

---

## Environment Variables

Key variables (see `.env.example` for full list):

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `RABBITMQ_URL` | Yes | RabbitMQ connection string |
| `MP_ACCESS_TOKEN` | No | Mercado Pago token (sandbox simulates if empty) |
| `PAYMENT_MODE` | No | `sandbox` or `production` |
| `FEATURE_SANDBOX_ENDPOINTS` | No | Enable test endpoints |

---

## Interaction Guidelines

### When Asked to Add Features

1. Check if similar patterns exist in codebase
2. Follow existing architecture (don't introduce new patterns)
3. Add tests for new functionality
4. Update relevant documentation

### When Asked to Fix Bugs

1. Reproduce the issue first (understand the flow)
2. Check logs for error context
3. Fix with minimal changes
4. Add test to prevent regression

### When Asked to Refactor

1. Ensure tests pass before refactoring
2. Make incremental changes
3. Run tests after each change
4. Don't change behavior, only structure

---

## Precautions

### Payment Operations

- PIX payments are irreversible once confirmed
- Always validate amounts (> 0, reasonable limits)
- Never expose internal payment IDs externally (use external_id)

### Security

- Never log sensitive data (tokens, full card numbers)
- Always validate webhook signatures in production
- Rate limit all endpoints

### Performance

- Use connection pooling (already configured)
- Avoid N+1 queries
- Cache when appropriate (Redis TTL)

---

## Contact Points

- **README.md** - Project overview and quick start
- **DEVELOPER_GUIDE.md** - Detailed setup instructions
- **ROADMAP.md** - Future development plans
- **.env.example** - All configuration options

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-12-22 | Initial MVP release |
