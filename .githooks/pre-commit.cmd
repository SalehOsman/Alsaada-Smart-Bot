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
  echo [PRE-COMMIT ERROR] Typecheck failed (G1). Run 'pnpm typecheck' to inspect errors.
  exit /b 1
)

call pnpm arch:verify
if %errorlevel% neq 0 (
  echo [PRE-COMMIT ERROR] Architecture verification failed (G2). Run 'pnpm arch:verify' to inspect handler line counts and required files.
  exit /b 1
)

call pnpm migration:verify
if %errorlevel% neq 0 (
  echo [PRE-COMMIT ERROR] Migration registry verification failed (G3). Run 'pnpm migration:verify' to inspect docs/19 parity.
  exit /b 1
)

call pnpm flow-contracts:verify
if %errorlevel% neq 0 (
  echo [PRE-COMMIT ERROR] Flow contracts verification failed (G4). Run 'pnpm flow-contracts:verify' to inspect contract errors.
  exit /b 1
)

call pnpm telegram-contracts:verify
if %errorlevel% neq 0 (
  echo [PRE-COMMIT ERROR] Telegram contracts violated (G5). Run 'pnpm telegram-contracts:verify' to inspect URL/Callback byte limits.
  exit /b 1
)

call pnpm latency:verify
if %errorlevel% neq 0 (
  echo [PRE-COMMIT ERROR] Latency anti-patterns detected (G6). Run 'pnpm latency:verify' to inspect blocking deleteMessage or awaited setMyCommands.
  exit /b 1
)

call pnpm rbac-matrix:verify
if %errorlevel% neq 0 (
  echo [PRE-COMMIT ERROR] RBAC matrix verification failed (G7). Run 'pnpm rbac-matrix:verify' to inspect deprecated roles or illegal permissions.
  exit /b 1
)

call pnpm field-masking:verify
if %errorlevel% neq 0 (
  echo [PRE-COMMIT ERROR] Field masking verification failed (G8). Run 'pnpm field-masking:verify' to inspect unmasked salary/compensation fields.
  exit /b 1
)

call pnpm observability:verify
if %errorlevel% neq 0 (
  echo [PRE-COMMIT ERROR] Observability verification failed (G9). Run 'pnpm observability:verify' to inspect console.error or empty catch blocks.
  exit /b 1
)

call pnpm test-authenticity:verify
if %errorlevel% neq 0 (
  echo [PRE-COMMIT ERROR] Test authenticity check failed (G10). Run 'pnpm test-authenticity:verify' to inspect sham assertions.
  exit /b 1
)

call pnpm legacy-parity:verify
if %errorlevel% neq 0 (
  echo [PRE-COMMIT ERROR] Legacy parity verification failed (G11). Run 'pnpm legacy-parity:verify' to inspect accounting invariants.
  exit /b 1
)

call pnpm financial:verify
if %errorlevel% neq 0 (
  echo [PRE-COMMIT ERROR] Financial integrity verification failed (G12). Run 'pnpm financial:verify' to inspect financial ledger errors.
  exit /b 1
)

call pnpm governance:tamper-check
if %errorlevel% neq 0 (
  echo [PRE-COMMIT ERROR] Governance tamper check failed (G13). Run 'pnpm governance:tamper-check' to inspect modified locked components.
  exit /b 1
)

call pnpm test:pre-commit
if %errorlevel% neq 0 (
  echo [PRE-COMMIT ERROR] Smart test guard failed (G14). Run 'pnpm test:pre-commit' to inspect failing tests on modified code.
  exit /b 1
)

echo [PRE-COMMIT] All 14 verifiers and smart test guard passed successfully.
exit /b 0
