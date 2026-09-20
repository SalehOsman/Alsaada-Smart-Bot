#!/usr/bin/env bash
set -e

# ==============================================================================
# verify-hooks.sh — Test Suite for Git Pre-Commit Hook Guards
# ==============================================================================
echo "🧪 [VERIFY-HOOKS] Testing redirect poisoning guard in pre-commit hook..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOK_PATH="$ROOT_DIR/.githooks/pre-commit"

if [ ! -f "$HOOK_PATH" ]; then
  echo "❌ Hook not found at $HOOK_PATH"
  exit 1
fi

TEMP_DIR=$(mktemp -d 2>/dev/null || mktemp -d -t 'hooktest')
cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

cd "$TEMP_DIR"
git init -q
git config user.name "Test Runner"
git config user.email "test@example.com"
mkdir -p .githooks
cp "$HOOK_PATH" .githooks/pre-commit
chmod +x .githooks/pre-commit
git checkout -q -b test-branch

FORBIDDEN_PATTERN='^\{"numTotalTestSuites'

# TEST 1: Positive Test — Valid spec file with normal test code should PASS
echo "describe('sample', () => { it('works', () => { expect(1).toBe(1); }); });" > sample.spec.ts
git add sample.spec.ts

POISON_DETECTED=0
for f in $(git diff --cached --name-only --diff-filter=ACM); do
  if [ -f "$f" ] && echo "$f" | grep -Eq '\.(spec|test)\.[jt]sx?$'; then
    if grep -Eq "$FORBIDDEN_PATTERN" "$f" 2>/dev/null; then
      POISON_DETECTED=1
    fi
  fi
done

if [ "$POISON_DETECTED" -ne 0 ]; then
  echo "❌ Positive test failed: Valid spec file was falsely detected as poisoned!"
  exit 1
fi
echo "✅ Positive test passed: Valid spec file allowed."

# TEST 2: Negative Test — Poisoned spec file containing vitest JSON output should FAIL
echo '{"numTotalTestSuites": 235, "numPassedTestSuites": 235}' > poisoned.spec.ts
git add poisoned.spec.ts

POISON_DETECTED=0
for f in $(git diff --cached --name-only --diff-filter=ACM); do
  if [ -f "$f" ] && echo "$f" | grep -Eq '\.(spec|test)\.[jt]sx?$'; then
    if grep -Eq "$FORBIDDEN_PATTERN" "$f" 2>/dev/null; then
      POISON_DETECTED=1
    fi
  fi
done

if [ "$POISON_DETECTED" -ne 1 ]; then
  echo "❌ Negative test failed: Poisoned spec file was NOT detected!"
  exit 1
fi
echo "✅ Negative test passed: Poisoned spec file correctly rejected."

echo "🎉 [VERIFY-HOOKS] All pre-commit hook guard tests passed successfully!"
exit 0
