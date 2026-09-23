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
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.precedents)) {
      return parsed as PrecedentIndex;
    }
    return {
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
      description: 'Zero-Token Precedent Index (invalid structure)',
      totalPrecedents: 0,
      precedents: [],
    };
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
  const precedents = Array.isArray(index?.precedents) ? index.precedents : [];
  const normalized = signature.trim().toLowerCase();
  return precedents.find(
    (p) =>
      p &&
      typeof p === 'object' &&
      (p.issueSignature?.toLowerCase() === normalized || p.id?.toLowerCase() === normalized)
  );
}

export function searchPrecedents(query: string, root = process.cwd()): Precedent[] {
  const index = loadPrecedentIndex(root);
  const precedents = Array.isArray(index?.precedents) ? index.precedents : [];
  const tokens = query
    .toLowerCase()
    .split(/[\s,._-]+/)
    .filter((t) => t.length >= 2);

  if (tokens.length === 0) return [];

  const scored: Array<{ precedent: Precedent; score: number }> = [];

  for (const p of precedents) {
    if (!p || typeof p !== 'object') continue;
    let score = 0;
    const keywords = Array.isArray(p.keywords) ? p.keywords : [];
    const textBlob = `${p.issueSignature || ''} ${keywords.join(' ')} ${p.approvedResolution || ''}`.toLowerCase();

    for (const token of tokens) {
      if (p.issueSignature?.toLowerCase().includes(token)) score += 3;
      if (keywords.some((k) => typeof k === 'string' && k.toLowerCase().includes(token))) score += 2;
      if (textBlob.includes(token)) score += 1;
    }

    if (score > 0) {
      scored.push({ precedent: p, score });
    }
  }

  return scored.sort((a, b) => b.score - a.score).map((s) => s.precedent);
}
