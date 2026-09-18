---
name: context-mode
description: >-
  Sandbox code execution, FTS5 persistent knowledge base, and context window optimization using context-mode MCP server.
  Use when exploring codebases, analyzing large files, running data-heavy commands, searching indexed session history, or fetching web content without flooding context.
---

# Context Mode Skill for Antigravity

This skill teaches the agent how to leverage `context-mode` MCP tools to reduce context consumption by up to 98% and avoid context window pollution.

## Core Principle: Think in Code
Instead of reading 50 files or running 10 shell commands and dumping raw output into the context window:
1. Write a script via `ctx_execute` or `ctx_execute_file` that computes the answer inside the sandbox.
2. `console.log()` / `print()` **only the final derived result**.
3. Never dump entire raw files or logs into the chat.

## Available Tools & When to Use

| Tool | Purpose | Example Argument |
| :--- | :--- | :--- |
| `ctx_execute` | Run JS/TS/Python/Shell script in sandbox. Only stdout enters context. | `{"language": "javascript", "code": "const fs=require('fs'); console.log(fs.readdirSync('.').length);"}` |
| `ctx_execute_file` | Read one file into `FILE_CONTENT` sandbox variable and extract specific parts. | `{"path": "package.json", "language": "javascript", "code": "const p=JSON.parse(FILE_CONTENT); console.log(Object.keys(p.dependencies).length);"}` |
| `ctx_batch_execute` | Run multiple repository commands in one batch, auto-index large outputs. | `{"commands": [{"label": "git status", "command": "git status -s"}], "queries": ["modified files"]}` |
| `ctx_fetch_and_index` | Fetch URL content, clean it, and index it into FTS5 without raw HTML dump. | `{"url": "https://example.com/api", "source": "api-docs"}` |
| `ctx_search` | Search indexed knowledge base and session memory using BM25 search. | `{"queries": ["clearing engine implementation", "outbox queue"]}` |
| `ctx_index` | Store file/directory or markdown into local FTS5 knowledge base for future recall. | `{"path": "docs", "source": "docs-archive"}` |
| `ctx_stats` | View session context savings and efficiency statistics. | `{}` |
| `ctx_doctor` | Diagnose runtime, Bun/Node, SQLite/FTS5 health. | `{}` |

## File Editing vs. File Analysis Rule
- **Editing code:** Use native `view_file` (with strict `StartLine`/`EndLine`) and `replace_file_content`.
- **Analyzing / Counting / Searching code:** Use `ctx_execute_file` or `ctx_execute` to keep raw bytes out of the conversation.
