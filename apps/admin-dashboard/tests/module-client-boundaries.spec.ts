import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CLIENT_NAVIGATION_ITEMS } from '../../../.generated/catalog/dashboard.client';

describe('Work Plan 89 — Dashboard Client Boundaries (Phase P4)', () => {
  it('verifies that dashboard.client.ts does not import server-only modules', () => {
    const clientFilePath = path.resolve(process.cwd(), '.generated/catalog/dashboard.client.ts');
    expect(fs.existsSync(clientFilePath)).toBe(true);

    const clientContent = fs.readFileSync(clientFilePath, 'utf-8');

    // Forbidden server imports in client registry
    const forbiddenPatterns = [
      '@alsaada/database',
      '@prisma/client',
      'prisma',
      'node:fs',
      'fs',
      'child_process',
      'next/headers',
      'process.env',
    ];

    for (const pattern of forbiddenPatterns) {
      expect(clientContent).not.toContain(pattern);
    }
  });

  it('ensures all client navigation items are strictly JSON-serializable primitives', () => {
    expect(CLIENT_NAVIGATION_ITEMS.length).toBeGreaterThan(0);

    for (const item of CLIENT_NAVIGATION_ITEMS) {
      expect(typeof item.id).toBe('string');
      expect(typeof item.titleArabic).toBe('string');
      expect(typeof item.module).toBe('string');
      expect(typeof item.category).toBe('string');

      // Zero function or complex class leakage
      for (const [key, value] of Object.entries(item)) {
        expect(['string', 'number', 'boolean']).toContain(typeof value);
      }
    }
  });

  it('ensures dashboard.client.ts exports valid typed array without undefined items', () => {
    expect(Array.isArray(CLIENT_NAVIGATION_ITEMS)).toBe(true);
    for (const item of CLIENT_NAVIGATION_ITEMS) {
      expect(item).toBeDefined();
      expect(item.id.length).toBeGreaterThan(0);
      expect(item.titleArabic.length).toBeGreaterThan(0);
    }
  });
});
