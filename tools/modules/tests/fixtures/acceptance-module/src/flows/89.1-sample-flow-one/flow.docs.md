# Flow 89.1: Sample Creation and Authorization

## Purpose
Acceptance testing fixture proving that new conversational flows can be introduced and executed cleanly inside an autonomous module without core changes.

## Roles
- `SUPER_ADMIN`
- `ADMIN`

## Telegram Ergonomics
- Callback: `action:sample:confirm` (21 bytes <= 36 bytes limit)
- Keyboard: 2 rows, max 2 buttons per row.
