import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { scaffoldIncident } from './scaffold-incident.js';

export type BranchKind = 'incident' | 'feature' | 'plan';

export interface ScaffoldBranchOptions {
  titleArabic?: string | undefined;
  allowDirty?: boolean | undefined;
  noCheckout?: boolean | undefined;
  dryRun?: boolean | undefined;
  root?: string | undefined;
}

export interface ScaffoldBranchResult {
  branchName: string;
  incidentPath?: string | undefined;
  switched: boolean;
}

export function formatBranchName(kind: BranchKind, slug: string): string {
  const cleanSlug = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!cleanSlug) {
    throw new Error('Branch slug cannot be empty');
  }

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  switch (kind) {
    case 'incident':
      return `fix/inc-${today}-${cleanSlug}`;
    case 'feature':
      return `feat/${cleanSlug}`;
    case 'plan':
      return `plan/${cleanSlug}`;
    default:
      throw new Error(`Unsupported branch kind: ${kind as string}`);
  }
}

export function checkGitTreeClean(root: string): { clean: boolean; statusOutput: string } {
  try {
    const statusOutput = execSync('git status --porcelain', {
      cwd: root,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return { clean: statusOutput.length === 0, statusOutput };
  } catch (err) {
    throw new Error(`Failed to check git status: ${String(err)}`);
  }
}

export function branchExists(branchName: string, root: string): boolean {
  try {
    execSync(`git rev-parse --verify refs/heads/${branchName}`, {
      cwd: root,
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

export function scaffoldBranch(
  kind: BranchKind,
  slug: string,
  options: ScaffoldBranchOptions = {},
): ScaffoldBranchResult {
  const root = resolve(options.root ?? process.cwd());

  if (!slug) {
    throw new Error(`Usage: pnpm branch:${kind} <slug> [title]`);
  }

  const branchName = formatBranchName(kind, slug);

  // Check working tree cleanliness unless allowDirty is specified
  if (!options.allowDirty) {
    const { clean, statusOutput } = checkGitTreeClean(root);
    if (!clean) {
      throw new Error(
        `Git working tree is not clean. Commit, stash, or clean working tree before creating branch '${branchName}'.\nUncommitted changes:\n${statusOutput}`,
      );
    }
  }

  // Check if branch already exists
  if (branchExists(branchName, root)) {
    throw new Error(`Branch '${branchName}' already exists. Switch to it or use a unique slug.`);
  }

  let switched = false;
  if (!options.dryRun && !options.noCheckout) {
    // Attempt checkout from main if possible, else create from current HEAD
    try {
      execSync(`git checkout -b ${branchName} main`, {
        cwd: root,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      switched = true;
    } catch {
      try {
        execSync(`git checkout -b ${branchName}`, {
          cwd: root,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        switched = true;
      } catch (err) {
        throw new Error(`Failed to create and checkout branch '${branchName}': ${String(err)}`);
      }
    }
  }

  let incidentPath: string | undefined;
  if (kind === 'incident') {
    const cleanSlug = slug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/^-+|-+$/g, '');
    incidentPath = scaffoldIncident(cleanSlug, options.titleArabic, root, branchName);
  }

  return {
    branchName,
    incidentPath,
    switched,
  };
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('tools/scaffold/scaffold-branch.ts')) {
  const kind = process.argv[2] as BranchKind;
  const slug = process.argv[3];
  const titleArabic = process.argv[4];
  const allowDirty = process.argv.includes('--allow-dirty');
  const dryRun = process.argv.includes('--dry-run');

  if (!kind || !['incident', 'feature', 'plan'].includes(kind) || !slug) {
    console.error('Usage: tsx tools/scaffold/scaffold-branch.ts <incident|feature|plan> <slug> [titleArabic] [--allow-dirty]');
    process.exit(1);
  }

  try {
    const res = scaffoldBranch(kind, slug, { titleArabic, allowDirty, dryRun });
    console.log(`✅ Successfully scaffolded isolated branch: ${res.branchName}`);
    if (res.switched) {
      console.log(`🔀 Switched to branch: ${res.branchName}`);
    }
    if (res.incidentPath) {
      console.log(`📝 Incident dossier scaffolded: ${res.incidentPath}`);
      console.log(`👉 Next steps:`);
      console.log(`   1. Write reproduction test in relevant package/module.`);
      console.log(`   2. Complete all 6 mandatory sections in ${res.incidentPath}.`);
      console.log(`   3. Verify with 'pnpm incident:verify' before requesting merge.`);
    }
  } catch (err: any) {
    console.error(`❌ Error: ${err.message}`);
    process.exit(1);
  }
}
