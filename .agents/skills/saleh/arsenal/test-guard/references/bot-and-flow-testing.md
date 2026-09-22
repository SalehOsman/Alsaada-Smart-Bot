# Bot Flow & Conversational Wizard Testing

In Al-Saada Smart Bot, all bot flows follow the 10-File Vertical Slice architecture and interact through grammY context and session state engines.

## 1. Flow Testing Matrix
Every flow under `modules/<module>/src/flows/<flow-slug>/` must have corresponding tests under `<module>/tests/flows/`:
- `flow.unit.spec.ts`: Unit tests for validators, calculators, and message formatters.
- `flow.integration.spec.ts`: End-to-end simulation of the multi-step conversational wizard.
- `flow.rbac.spec.ts`: Authorization tests proving that unauthorized roles are blocked.
- `flow.data.spec.ts`: Financial ledger and database transaction persistence tests.

## 2. In-Place Message Editing Testing
The bot strictly avoids spamming chats with new messages. Tests must assert in-place editing:
```typescript
test('advancing step edits message in place with new text and keyboard', async () => {
  const ctx = createMockBotContext({
    session: { flow: 'ADVANCE_REQUEST', step: 'ENTER_AMOUNT' },
    callbackQuery: { data: 'advance:confirm' },
  });

  await handleAdvanceStep(ctx);

  // Assert in-place edit was called
  expect(ctx.editMessageText).toHaveBeenCalledWith(
    expect.stringContaining('تأكيد السلفة'),
    expect.objectContaining({
      parse_mode: 'HTML',
      reply_markup: expect.any(Object),
    })
  );

  // Assert session updated
  expect(ctx.session.step).toBe('CONFIRMATION');
});
```

## 3. Testing RBAC & Role Immunity (Gate G7)
Verify access matrix explicitly:
```typescript
test.each([
  ['SUPER_ADMIN', true],
  ['GENERAL_MANAGER', true],
  ['HR_OPERATOR', false],
  ['FINANCE_AUDITOR', false],
  ['WORKER', false],
])('role %s access to offboarding flow -> %s', async (role, expectedAllowed) => {
  const ctx = createMockBotContext({ userRole: role });
  const canAccess = await checkFlowAccess(ctx, 'WORKER_OFFBOARDING');
  expect(canAccess).toBe(expectedAllowed);
});
```
