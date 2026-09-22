# Vitest and TypeScript Testing Patterns

## 1. Boundary Mocking in Vitest
In Al-Saada Smart Bot, use Vitest's mocking capabilities strictly at true system boundaries:

### Justified System Boundary Mocks:
- **Telegram HTTP API Calls:**
  ```typescript
  import { vi } from 'vitest';
  const mockApi = {
    editMessageText: vi.fn().mockResolvedValue({ message_id: 100 }),
    sendMessage: vi.fn().mockResolvedValue({ message_id: 101 }),
    answerCallbackQuery: vi.fn().mockResolvedValue(true),
  };
  ```
- **Time & Clock:**
  ```typescript
  import { vi, beforeEach, afterEach } from 'vitest';
  const PINNED_BASE_TIME = new Date('2026-09-21T00:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
  ```

### Unjustified / Prohibited Mocks:
- Mocking internal helper functions via `vi.spyOn(internalHelper, 'calculate')`.
- Mocking domain models or Zod parsing functions.
- Mocking the entire database repository when testing flow business logic — use test transactions or in-memory repositories that fulfill the domain interface.

## 2. Parameterized Testing with `test.each`
Consolidate repeated test structures into clean data-driven tables:
```typescript
describe('Egyptian National ID Validation', () => {
  test.each([
    ['29812010101234', true, 'Valid 14-digit national ID'],
    ['19812010101234', false, 'Invalid century code (1)'],
    ['29813010101234', false, 'Invalid month (13)'],
    ['29812320101234', false, 'Invalid day (32)'],
    ['2981201010123', false, 'Too short (13 digits)'],
  ])('evaluates %s -> %s (%s)', (nationalId, expected, _description) => {
    const result = validateNationalId(nationalId);
    expect(result.isValid).toBe(expected);
  });
});
```

## 3. Real State Construction
Use test builders instead of raw fake objects:
```typescript
// ❌ Bad: Partial mock pretending to be a Worker
const fakeWorker = { id: '123' } as any;

// ✅ Good: Typed test factory
const worker = createTestWorker({
  id: 'worker-123',
  nationalId: '29812010101234',
  baseSalary: 6000,
});
```
