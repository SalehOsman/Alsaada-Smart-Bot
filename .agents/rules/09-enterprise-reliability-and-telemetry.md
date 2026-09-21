# Domain Rulebook 09: Enterprise Reliability, Outbox & Telemetry Suite

> **Authority:** Derived from [`GEMINI.md`](../../GEMINI.md) Part 9 & [`packages/shared/`](../../packages/shared/).  
> **Status:** Mandatory Architectural Integrity Standard (G9, G21).

---

## 1. Novel Enterprise Reliability Pillars

To guarantee zero data loss, high concurrency safety, and deterministic production operations, all services must conform to the 5 enterprise reliability pillars:

### 1.1 Strict Idempotency (G21)
- Every state mutation, accounting journal entry, and external integration event must require a unique `idempotencyKey`.
- Handlers must inspect and enforce idempotency locks before executing business logic, discarding duplicates safely.

### 1.2 Zod Runtime Boundary Deserialization
- Untyped `JSON.parse` or implicit type casting across system boundaries (HTTP requests, Telegram updates, Redis queues, external APIs) is strictly banned.
- All incoming payloads must be parsed and validated through strongly-typed Zod schemas (`safeParse`).

### 1.3 Deterministic Pinned Clock
- Direct usage of non-deterministic `Date.now()` or unseeded timestamps inside unit tests is forbidden.
- Always use `PINNED_BASE_TIME` in tests to ensure reproducible assertions.

### 1.4 Zero Console Policy (G9)
- Standard `console.log`, `console.error`, and `console.warn` calls are strictly banned in production code.
- All telemetry, operational events, and warnings must be routed through the enterprise structured logger:
  ```typescript
  import { logger } from '@alsaada/shared/logger';
  logger.info({ context: 'PaymentService', action: 'charge', amount }, 'Payment processed');
  ```

### 1.5 Regression Test Lock
- All tests guarding against previously identified regressions are permanently locked under `test:<path>` in `governance.lock.json` and cannot be deleted or weakened.

---

## 2. Transactional Outbox Pattern

1. **Decoupled Asynchronous Side-Effects:**
   - Direct synchronous network calls to external third parties (e.g., Google Sheets API, SMS gateways, external webhooks) from within the bot request-response loop are prohibited.
   - All side-effects must be persisted atomically to the `TransactionalOutbox` table within the active database transaction.
2. **Outbox Worker Processing:**
   - The standalone asynchronous outbox worker handles dispatching, retrying with exponential backoff, and dead-letter queue management.

---

## 3. Telemetry & APM Observability

1. **Correlation IDs:** Every incoming bot update or API request must be assigned a unique `traceId` / `correlationId` carried across log contexts, queue messages, and error responses.
2. **Sub-300ms Budget (G6):** All bot command responses must complete and send a reply within 300ms. Heavy computations must be offloaded to worker queues.
