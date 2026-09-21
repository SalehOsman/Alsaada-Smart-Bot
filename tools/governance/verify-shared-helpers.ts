import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createResult,
  fail,
  warn,
  isCliEntrypoint,
  listFilesRecursive,
  printAndExit,
  toRepoPath,
  type VerificationResult,
} from "./common.js";

export function verifySharedHelpers(root = process.cwd()): VerificationResult {
  const result = createResult();
  const modulesDir = join(root, "modules");
  if (!existsSync(modulesDir)) return result;

  const filesToScan: string[] = [];
  for (const file of listFilesRecursive(modulesDir)) {
    if (
      file.endsWith(".ts") &&
      !file.endsWith(".d.ts") &&
      !file.includes("/tests/")
    ) {
      filesToScan.push(file);
    }
  }

  result.checked = filesToScan.length;

  for (const file of filesToScan) {
    const relPath = toRepoPath(root, file);
    let content: string;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }

    // Pattern 1: Inline manual Eastern Arabic digit normalization regex
    if (
      content.includes("[٠-٩]") &&
      !content.includes("@alsaada/shared/domain") &&
      !content.includes("@alsaada/regional-engine")
    ) {
      warn(
        result,
        `${relPath}: Detected inline Arabic digit normalization regex. Prefer importing 'normalizeArabicDigits' from '@alsaada/shared/domain'.`,
      );
    }

    // Pattern 2: Duplicated toCents function declaration
    if (
      /function\s+toCents\b/.test(content) &&
      !relPath.startsWith("packages/shared/")
    ) {
      fail(
        result,
        `${relPath}: Duplicated 'toCents' function found. Reuse '@alsaada/shared/domain' per the Reuse-First Gate.`,
      );
    }
  }

  return result;
}

if (isCliEntrypoint(import.meta.url)) {
  printAndExit("shared-helpers:verify", verifySharedHelpers(process.cwd()));
}
