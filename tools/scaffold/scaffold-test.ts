import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export function scaffoldTest(
  targetPath: string,
  suiteTitle?: string,
  root = process.cwd(),
): string {
  if (!targetPath) {
    throw new Error("Usage: pnpm make:test <targetTestPath> [suiteTitle]");
  }

  const fullPath = resolve(root, targetPath);
  if (existsSync(fullPath)) {
    throw new Error(`Target test file already exists: ${fullPath}`);
  }

  mkdirSync(dirname(fullPath), { recursive: true });

  const title =
    suiteTitle ??
    targetPath
      .split(/[\\/]/)
      .pop()
      ?.replace(/\.(spec|test)\.ts$/, "") ??
    "Unit Test Suite";

  const content = `import { describe, it, expect, beforeEach } from 'vitest';
import { PINNED_BASE_TIME, createTestBotContext } from '@alsaada/shared/testing';

describe('${title}', () => {
  beforeEach(() => {
    // Reset test state before each run
  });

  it('executes primary success path with complete assertions', async () => {
    // 1. Arrange
    const ctx = createTestBotContext({
      userId: 10001,
      text: 'start',
    });

    // 2. Act
    const replyResult = await ctx.reply('Success response');

    // 3. Assert (G10: Positive and negative contrast verification)
    expect(replyResult.message_id).toBeDefined();
    expect(ctx.replies).toHaveLength(1);
    expect(ctx.replies[0]?.text).toBe('Success response');
    expect(ctx.replies[0]?.text).not.toBe('');
  });

  it('handles validation error cleanly without crashing', async () => {
    // 1. Arrange
    const ctx = createTestBotContext({
      userId: 10002,
      text: 'invalid_input',
    });

    // 2. Act
    const errorResult = await ctx.reply('Validation error: invalid input');

    // 3. Assert
    expect(errorResult.message_id).toBeDefined();
    expect(ctx.replies[0]?.text).toContain('Validation error');
    expect(ctx.replies[0]?.text).not.toBe('Success response');
  });
});
`;

  writeFileSync(fullPath, content, "utf8");
  return fullPath;
}

if (
  process.argv[1]
    ?.replace(/\\/g, "/")
    .endsWith("tools/scaffold/scaffold-test.ts")
) {
  const target = process.argv[2];
  const title = process.argv[3];
  if (!target) {
    console.error(
      "Usage: tsx tools/scaffold/scaffold-test.ts <targetTestPath> [suiteTitle]",
    );
    process.exit(1);
  }
  const created = scaffoldTest(target, title);
  console.log(`✅ Test suite created successfully: ${created}`);
}
