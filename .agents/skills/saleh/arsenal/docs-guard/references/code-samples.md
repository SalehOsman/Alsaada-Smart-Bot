# Code Samples in Documentation

All code samples embedded in markdown documentation, architecture guides, and walkthoughs must adhere to these standards:

## 1. Runnable and Type-Checked
- Snippets must use valid TypeScript syntax.
- All referenced packages must match the monorepo workspace dependencies (`@alsaada/core-components`, `@alsaada/shared/logger`, etc.).
- Avoid pseudo-code unless explicitly tagged as conceptual pseudocode.

## 2. Realistic Domain Data
- Use realistic Egyptian names, National IDs with valid check digits, and realistic currency amounts (EGP).
- Never use placeholder values like `foo`, `bar`, `123456`, or fake phone numbers that fail regex validation.

## 3. Security Hygiene
- Never embed real API keys, Telegram Bot Tokens, database connection strings, or passwords.
- Always use environment variable references (`process.env.BOT_TOKEN`) or mock dummy keys (`test-token-xxxx`).
