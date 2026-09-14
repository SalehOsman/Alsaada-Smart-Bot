---
name: open-code-review
description: >-
  Runs automated AI-powered code review and static analysis using Alibaba Open Code Review (OCR).
  Use to inspect git diffs, review staged changes, enforce project governance rules, or audit files.
---

# Alibaba Open Code Review (OCR) Skill

This skill teaches the agent how to run and interpret code reviews using the Alibaba Open Code Review CLI (`ocr`) and its MCP server.

## Overview
Alibaba Open Code Review combines deterministic AST/diff filtering with an LLM agent to detect bugs, dead code, memory leaks, concurrency issues, and code smells with line-level accuracy.

## Recommended Review Command

Always use `--concurrency 2` when running reviews to respect API rate limits (such as Google Gemini Free Tier 15 RPM) and prevent 429 retries:

```bash
ocr review --concurrency 2
```

### Reviewing Specific Scopes
- **Preview reviewable files (0 tokens):**
  ```bash
  ocr review --preview
  ```
- **Review with Project Governance Context:**
  ```bash
  ocr review --concurrency 2 --background-file ./AGENTS.md
  ```
- **Review a Specific Commit:**
  ```bash
  ocr review --commit <commit-hash> --concurrency 2
  ```
- **Scan an entire directory (no diff needed):**
  ```bash
  ocr scan --path modules/canteen --concurrency 2
  ```
- **Launch Interactive Web UI Viewer:**
  ```bash
  ocr viewer
  ```
- **Zero-Token Delegation Mode (Local Antigravity Review):**
  ```bash
  ocr delegate preview
  ```

## Permanent Code Reviewer Subagent (`code-reviewer`)
The project designates a permanent subagent `code-reviewer` defined via `.agents/subagents/code-reviewer.md` and governed by `.agents/rules/alibaba-code-standards.md`.
When requested to review code, invoke the subagent:
```json
{
  "Subagents": [
    {
      "TypeName": "code-reviewer",
      "Role": "Alibaba Code Reviewer",
      "Prompt": "Review staged changes or specific files against Alibaba 6 pillars and Al-Saada governance."
    }
  ]
}
```

## Al-Saada Smart Bot Governance Rules
When reviewing code for Al-Saada Smart Bot, always verify:
1. **Zero Sync Sheets API calls:** Handlers must never call Google Sheets synchronously; all external sync must go through `TransactionalOutboxQueue`.
2. **Double-Entry & Clearing:** Financial operations must enforce double-entry ledger integrity and `TripleBalanceClearingEngine`.
3. **Strict TypeScript 5.9+:** Zero unjustified `any` types; all schemas and return types must be strictly typed.
4. **In-Place UI Navigation:** Telegram screens must use single-message editing (`renderWizardStep` / `editMessageText`) with explicit back buttons.
5. **Modular Isolation:** Changes within a module (`modules/*`) must not touch other modules without architectural approval.

