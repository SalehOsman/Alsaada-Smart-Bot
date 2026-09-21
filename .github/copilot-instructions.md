# GitHub Copilot Instructions — Al-Saada Smart Bot Enterprise

## Sovereign Single Source of Truth
- The master constitutional micro-kernel is [`GEMINI.md`](../GEMINI.md). All suggestions and code generation must comply with it.
- Specialized domain rulebooks reside in `.agents/rules/` (01 to 10).
- The functional baseline is `F:\HR`. Zero flow divergence or unauthorized modifications to wizard steps.

## Coding Standards & Conventions
- **TypeScript:** Strict mode with `exactOptionalPropertyTypes: true` and `noUncheckedIndexedAccess: true`. Zero `any`.
- **Vertical Slice Standard:** Always adhere to the 10-file vertical slice standard for bot flows.
- **Telegram UX:** Inline keyboard callback data <= 36 bytes (hard limit 64 bytes). Inline button text <= 16 characters. Max 7 rows, max 3 buttons per row.
- **Observability:** Use `@alsaada/shared/logger`. Never suggest `console.log` or `console.error`.
- **Testing:** Standard Arrange-Act-Assert structure. Pin time using `PINNED_BASE_TIME` from `@alsaada/shared/testing`. No sham assertions (`expect(true).toBe(true)`).
- **Domain Utilities:** Check `@alsaada/shared/domain` before implementing currency, Arabic text, national ID, or pagination helpers.

## Sovereign Arabic Tokens (Do Not Translate)
- Lock: `«نعم اقفل»`
- Unlock: `«موافق على الفتح»`
- Merge: `«ادمج الفرع»`
- Governance Change: `«موافق على التعديل او الايقاف او الحذف»`
- Code Fix: `«موافق على تعديل الكود المصدري»`
