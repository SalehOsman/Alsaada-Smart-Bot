@echo off
rem Al-Saada Smart Bot Enterprise — Pre-Commit Governance Guard (Windows)
echo [PRE-COMMIT] Running strict TypeScript, contracts, and architecture checks...

call pnpm typecheck
if %errorlevel% neq 0 (
  echo [PRE-COMMIT ERROR] Typecheck failed. Fix TypeScript errors before committing.
  exit /b 1
)

call pnpm telegram-contracts:verify
if %errorlevel% neq 0 (
  echo [PRE-COMMIT ERROR] Telegram contracts violated. Check URL/Callback byte limits.
  exit /b 1
)

call pnpm arch:verify
if %errorlevel% neq 0 (
  echo [PRE-COMMIT ERROR] Architecture verification failed. Check handler line counts and required files.
  exit /b 1
)

echo [PRE-COMMIT] All pre-commit checks passed successfully.
exit /b 0
