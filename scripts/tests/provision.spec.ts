import { describe, it, expect, afterAll } from 'vitest';
import { provision } from '../provision.js';
import { prisma, disconnectDatabase } from '../../packages/database/src/client.js';

describe('System Provisioning Suite (WP 113 - Singleton Engine)', () => {
  afterAll(async () => {
    await disconnectDatabase();
  });

  it('should run provisioning successfully and establish the singleton company profile', async () => {
    const startTime = Date.now();
    await expect(provision()).resolves.not.toThrow();
    const duration = Date.now() - startTime;

    // Budget: Provisioning must complete efficiently (< 5000ms including DB roundtrips)
    expect(duration).toBeLessThan(5000);

    // Verify Singleton Company Profile
    const profiles = await prisma.companyProfile.findMany();
    expect(profiles.length).toBe(1);
    expect(profiles[0]?.tradeName).toContain('شركة السعادة');
    expect(profiles[0]?.baseCurrency).toBe('EGP');

    // Verify Default Project
    const project = await prisma.project.findFirst({
      where: { code: 'PRJ-MAIN' },
    });
    expect(project).toBeDefined();
    expect(project?.code).toBe('PRJ-MAIN');
  });

  it('should be strictly idempotent on successive executions without duplicate records', async () => {
    // Run second time
    await expect(provision()).resolves.not.toThrow();

    // Verify still exactly 1 profile
    const profiles = await prisma.companyProfile.findMany();
    expect(profiles.length).toBe(1);

    // Verify still exactly 1 default project
    const defaultProjects = await prisma.project.findMany({
      where: { code: 'PRJ-MAIN' },
    });
    expect(defaultProjects.length).toBe(1);
  });
});
