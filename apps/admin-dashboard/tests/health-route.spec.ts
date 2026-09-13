import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@alsaada/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@alsaada/database')>();

  return {
    ...actual,
    prisma: {
      $queryRawUnsafe: vi.fn(),
      auditLog: { findFirst: vi.fn() },
      systemErrorLog: { findFirst: vi.fn() },
    },
  };
});

import { prisma } from '@alsaada/database';
import { GET } from '../src/app/api/health/route';

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValue([{ ok: 1 }] as never);
    vi.mocked(prisma.auditLog.findFirst).mockResolvedValue({ traceId: null } as never);
    vi.mocked(prisma.systemErrorLog.findFirst).mockResolvedValue({
      traceId: null,
      service: 'admin-dashboard',
    } as never);
  });

  it('returns ready only after the database and migrated trace columns are readable', async () => {
    const traceId = 'a1b2c3d4-e5f6-4789-abcd-ef0123456789';
    const response = await GET(new NextRequest('http://localhost:3002/api/health', {
      headers: { 'x-trace-id': traceId },
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-trace-id')).toBe(traceId);
    await expect(response.json()).resolves.toEqual({
      status: 'ready',
      service: 'admin-dashboard',
      version: expect.any(String),
      commitSha: expect.any(String),
      buildTime: expect.any(String),
      traceId,
    });
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith('SELECT 1');
    expect(prisma.auditLog.findFirst).toHaveBeenCalledWith({
      select: { traceId: true },
      orderBy: { timestamp: 'desc' },
    });
    expect(prisma.systemErrorLog.findFirst).toHaveBeenCalledWith({
      select: { traceId: true, service: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('fails closed with a trace identifier and no database details', async () => {
    vi.mocked(prisma.auditLog.findFirst).mockRejectedValueOnce(
      new Error('password=database-secret host=postgres'),
    );

    const response = await GET(new NextRequest('http://localhost:3002/api/health'));
    const body = await response.json() as Record<string, unknown>;
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(503);
    expect(body.status).toBe('unavailable');
    expect(body.service).toBe('admin-dashboard');
    expect(body.version).toBeDefined();
    expect(body.commitSha).toBeDefined();
    expect(body.buildTime).toBeDefined();
    expect(body.traceId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(response.headers.get('x-trace-id')).toBe(body.traceId);
    expect(serialized).not.toContain('database-secret');
    expect(serialized).not.toContain('postgres');
    expect(serialized).not.toContain('password');
  });
});
