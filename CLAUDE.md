# Claude Instructions — Al-Saada Smart Bot Enterprise

Welcome to the **Al-Saada Smart Bot** monorepo. This file provides critical context and operational commands for Claude Code and Claude-based developer agents.

---

## 1. Sovereign SSOT Authority & Precedence

All agent behavior in this repository is strictly governed by the sovereign Single Source of Truth:

👉 **[`GEMINI.md`](GEMINI.md)**

- **Constitutional Precedence:** Direct User Instructions > `GEMINI.md` (Micro-Kernel SSOT) > `docs/27` (Quality Gates) > `.agents/rules/` (10 Modular Rulebooks) > Legacy Docs.
- **The `/saleh` Strategic Advisor:** `/saleh` is the sovereign executive proxy and strategic auditor. Advisory and observation sovereignty only; zero direct code edits.
- **Chief Arbitrator:** Adjudicates cross-squad deadlocks and enforces the Missing Knowledge Protocol.

---

## 2. Common Engineering Commands

```bash
# Typecheck
pnpm typecheck

# Unit & Integration Tests
pnpm test
pnpm test:flow <flow-path>
pnpm test:pre-commit

# Scaffolding CLI Generators
pnpm make:flow <module> <flowKey> <flowSlug> <titleArabic>
pnpm make:test <targetPath> [suiteTitle]
pnpm make:incident <slug> [titleArabic]

# Architecture & Governance Checks
pnpm arch:verify
pnpm flow-contracts:verify
pnpm telegram-contracts:verify
pnpm governance:tamper-check
pnpm governance:verify

# Self-Healing Code Formatting
pnpm preflight:fix

# Full CI Simulation (23 Quality Gates + Vitest)
pnpm ci:simulate
```

---

## 3. Strict Architectural Mandates

1. **F:\HR Baseline Parity (G3, G11):** 100% exact parity with legacy system in `F:\HR`. Zero flow divergence without explicit written authorization.
2. **10-File Vertical Slice (G2):** Each bot flow in `modules/<module>/src/flows/<slug>/` consists strictly of:
   `flow.contract.json`, `index.ts`, `controller.ts`, `menu.builder.ts`, `action.handler.ts`, `service.ts`, `types.ts`, `validator.ts`, `error.handler.ts`, and corresponding test in `<module>/tests/flows/`.
3. **Telegram Mobile Viewport Budget (36/16/7/3) (G5, G22):**
   - Max 36 bytes for callback data.
   - Max 16 characters per inline button label.
   - Max 7 rows per keyboard; max 3 buttons per row.
   - Multi-step wizards update messages in-place via `editMessageText`.
4. **Zero Console Policy (G9):** Use `@alsaada/shared/logger`. No direct `console.log` or `console.error` in production.
5. **Deterministic Time (G23):** Use `PINNED_BASE_TIME` from `@alsaada/shared/testing`. No raw unpinned `Date.now()`.
6. **Reuse-First Gate:** Reuse helpers from `@alsaada/shared/domain` before writing new utility functions.

---

## 4. Untranslated Sovereign Arabic Approval Formulas

The following constitutional formulas must remain strictly in their original Arabic text:
- **Lock Entity:** `«نعم اقفل»`
- **Unlock Entity:** `«موافق على الفتح»` or `«نعم موافق على التعديل»`
- **Merge to Main:** `«ادمج الفرع»`
- **Universal Governance Change:** `«موافق على التعديل او الايقاف او الحذف»`
- **Source Code Defect Fix:** `«موافق على تعديل الكود المصدري»`

---

## 5. Git Branch Lifecycle & Strict Main Immunity

- Direct commits or pushes to `main` are strictly blocked (`Exit 1`).
- All work happens on dedicated branches: `feat/<name>`, `fix/<name>`, `plan/<wp-number>-<slug>`, `chore/<name>`.
- Merging into `main` requires `pnpm ci:simulate` clean pass and the verbatim formula `«ادمج الفرع»`.
