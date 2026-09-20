@echo off
setlocal enabledelayedexpansion
rem Al-Saada Smart Bot Enterprise — Pre-Commit Governance Guard (Windows)

REM 0. فحص الفرع الحالي لمنع الـ Commit المباشر على main
set CURRENT_BRANCH=
for /f "tokens=*" %%i in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set CURRENT_BRANCH=%%i

if "%CURRENT_BRANCH%"=="main" (
  set MERGE_HEAD_FILE=
  for /f "tokens=*" %%m in ('git rev-parse --git-path MERGE_HEAD 2^>nul') do set MERGE_HEAD_FILE=%%m
  if not exist "!MERGE_HEAD_FILE!" (
    echo.
    echo 🛑 [GOVERNANCE ERROR] Direct commits to 'main' branch are strictly prohibited.
    echo 📌 Create a dedicated branch: git checkout -b feat/^<name^>
    echo 🔒 Merge to main requires full verification and explicit approval: "ادمج الفرع"
    echo.
    exit /b 1
  )
)

REM 0.1. حماية من تلف ملفات الاختبار (Redirect Poisoning Guard)
for /f "tokens=*" %%f in ('git diff --cached --name-only --diff-filter=ACM') do (
  set "FILE_PATH=%%f"
  echo !FILE_PATH! | findstr /R /C:"\.[spec|test]\.[jt]s" /C:"\.[spec|test]\.[jt]sx" >nul
  if not errorlevel 1 (
    if exist "!FILE_PATH!" (
      findstr /R /C:"^{\"numTotalTestSuites" "!FILE_PATH!" >nul 2>&1
      if not errorlevel 1 (
        echo ❌ [PRE-COMMIT ERROR] ملف اختبار مُتلف باسم !FILE_PATH! — يحتوي مخرجات vitest JSON
        exit /b 1
      )
    )
  )
)

echo [PRE-COMMIT] Running strict TypeScript, contracts, and architecture checks...

call pnpm typecheck
if %errorlevel% neq 0 (
  echo [PRE-COMMIT ERROR] Typecheck failed. Fix TypeScript errors before committing.
  exit /b 1
)

call pnpm arch:verify
if %errorlevel% neq 0 (
  echo [PRE-COMMIT ERROR] Architecture verification failed. Check handler line counts and required files.
  exit /b 1
)

call pnpm migration:verify
if %errorlevel% neq 0 (
  echo [PRE-COMMIT ERROR] Migration registry verification failed. Check docs/19 parity.
  exit /b 1
)

call pnpm flow-contracts:verify
if %errorlevel% neq 0 (
  echo [PRE-COMMIT ERROR] Flow contracts verification failed.
  exit /b 1
)

call pnpm telegram-contracts:verify
if %errorlevel% neq 0 (
  echo [PRE-COMMIT ERROR] Telegram contracts violated. Check URL/Callback byte limits.
  exit /b 1
)

call pnpm latency:verify
if %errorlevel% neq 0 (
  echo [PRE-COMMIT ERROR] Latency anti-patterns detected. Blocking deleteMessage or awaited setMyCommands found.
  exit /b 1
)

call pnpm rbac-matrix:verify
if %errorlevel% neq 0 (
  echo [PRE-COMMIT ERROR] RBAC matrix verification failed. Deprecated roles or illegal permissions found.
  exit /b 1
)

call pnpm field-masking:verify
if %errorlevel% neq 0 (
  echo [PRE-COMMIT ERROR] Field masking verification failed. Unmasked salary/compensation fields detected.
  exit /b 1
)

call pnpm observability:verify
if %errorlevel% neq 0 (
  echo [PRE-COMMIT ERROR] Observability verification failed. console.error or empty catch blocks found.
  exit /b 1
)

call pnpm test-authenticity:verify
if %errorlevel% neq 0 (
  echo [PRE-COMMIT ERROR] Test authenticity check failed. Sham assertions found.
  exit /b 1
)

call pnpm legacy-parity:verify
if %errorlevel% neq 0 (
  echo [PRE-COMMIT ERROR] Legacy parity verification failed. Accounting invariants violated.
  exit /b 1
)

call pnpm financial:verify
if %errorlevel% neq 0 (
  echo [PRE-COMMIT ERROR] Financial integrity verification failed.
  exit /b 1
)

call pnpm governance:tamper-check
if %errorlevel% neq 0 (
  echo [PRE-COMMIT ERROR] Governance tamper check failed. Locked components modified without explicit unlock.
  exit /b 1
)

call pnpm test:pre-commit
if %errorlevel% neq 0 (
  echo [PRE-COMMIT ERROR] Smart test guard failed. Related tests failed on modified code.
  exit /b 1
)

echo [PRE-COMMIT] All 11 verifiers and smart test guard passed successfully.
exit /b 0
