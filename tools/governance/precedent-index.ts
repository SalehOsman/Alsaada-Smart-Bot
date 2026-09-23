import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Precedent {
  id: string;
  issueSignature: string;
  keywords: string[];
  verdict: string;
  confidence: number;
  constitutionalGate: string;
  approvedResolution: string;
  recordedAt: string;
}

export interface PrecedentIndex {
  version: string;
  updatedAt: string;
  description: string;
  totalPrecedents: number;
  precedents: Precedent[];
}

export function getPrecedentIndexPath(root = process.cwd()): string {
  return join(root, '.agents', 'knowledge', 'precedents', 'index.json');
}

export function loadPrecedentIndex(root = process.cwd()): PrecedentIndex {
  const filePath = getPrecedentIndexPath(root);
  if (!existsSync(filePath)) {
    return {
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
      description: 'Zero-Token Precedent Index',
      totalPrecedents: 0,
      precedents: [],
    };
  }

  try {
    const raw = readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as PrecedentIndex;
  } catch {
    return {
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
      description: 'Zero-Token Precedent Index (fallback)',
      totalPrecedents: 0,
      precedents: [],
    };
  }
}

export function queryPrecedentBySignature(signature: string, root = process.cwd()): Precedent | undefined {
  const index = loadPrecedentIndex(root);
  const normalized = signature.trim().toLowerCase();
  return index.precedents.find(
    (p) => p.issueSignature.toLowerCase() === normalized || p.id.toLowerCase() === normalized
  );
}

export function searchPrecedents(query: string, root = process.cwd()): Precedent[] {
  const index = loadPrecedentIndex(root);
  const tokens = query
    .toLowerCase()
    .split(/[\s,._-]+/)
    .filter((t) => t.length >= 2);

  if (tokens.length === 0) return [];

  const scored: Array<{ precedent: Precedent; score: number }> = [];

  for (const p of index.precedents) {
    let score = 0;
    const textBlob = `${p.issueSignature} ${p.keywords.join(' ')} ${p.approvedResolution}`.toLowerCase();

    for (const token of tokens) {
      if (p.issueSignature.toLowerCase().includes(token)) score += 3;
      if (p.keywords.some((k) => k.toLowerCase().includes(token))) score += 2;
      if (textBlob.includes(token)) score += 1;
    }

    if (score > 0) {
      scored.push({ precedent: p, score });
    }
  }

  return scored.sort((a, b) => b.score - a.score).map((s) => s.precedent);
}
