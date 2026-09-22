import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SitesHubService } from '../flow.service.js';
import type { SitesHubRepository } from '../flow.repository.js';
import type { SiteDto } from '../flow.types.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.2 Unit Tests — SitesHub', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const sampleSites: SiteDto[] = [
    {
      id: 's-1',
      code: 'STE-01',
      name: 'موقع السويس للإنشاءات',
      status: 'ACTIVE',
      governorate: 'السويس',
      projectId: 'p-1',
      projectName: 'مشروع تطوير الميناء',
      geofenceRadiusMeters: 250,
      latitude: 29.9668,
      longitude: 32.5498,
      workerCount: 15,
    },
    {
      id: 's-2',
      code: 'STE-02',
      name: 'محجر العين السخنة',
      status: 'PAUSED',
      governorate: 'السويس',
      projectId: null,
      projectName: null,
      geofenceRadiusMeters: 500,
      latitude: null,
      longitude: null,
      workerCount: 0,
    },
  ];

  it('lists sites correctly from repository', async () => {
    // Arrange
    const mockRepo = {
      listSites: vi.fn().mockResolvedValue(sampleSites),
    } as unknown as SitesHubRepository;
    const service = new SitesHubService(mockRepo);

    // Act
    const sites = await service.listSites();

    // Assert
    expect(sites).toHaveLength(2);
    expect(sites[0]!.name).toBe('موقع السويس للإنشاءات');
    expect(mockRepo.listSites).toHaveBeenCalledTimes(1);
  });

  it('generates next suggested site code incrementing highest index', async () => {
    // Arrange
    const mockRepo = {
      listSites: vi.fn().mockResolvedValue(sampleSites),
    } as unknown as SitesHubRepository;
    const service = new SitesHubService(mockRepo);

    // Act
    const nextCode = await service.getNextSuggestedCode();

    // Assert
    expect(nextCode).toBe('STE-03');
  });

  it('toggles site operational status between active and paused', async () => {
    // Arrange
    const mockRepo = {
      toggleSiteStatus: vi.fn().mockResolvedValue({
        ...sampleSites[0],
        status: 'PAUSED',
      }),
    } as unknown as SitesHubRepository;
    const service = new SitesHubService(mockRepo);

    // Act
    const updated = await service.toggleSiteStatus('STE-01');

    // Assert
    expect(updated.status).toBe('PAUSED');
    expect(mockRepo.toggleSiteStatus).toHaveBeenCalledWith('STE-01');
  });

  it('prevents creating site with duplicate code and rejects submission', async () => {
    // Arrange
    const mockRepo = {
      getSiteByCode: vi.fn().mockResolvedValue(sampleSites[0]),
      createSite: vi.fn(),
    } as unknown as SitesHubRepository;
    const service = new SitesHubService(mockRepo);

    // Act
    const res = await service.createSite({
      name: 'موقع جديد',
      code: 'STE-01',
      geofenceRadiusMeters: 250,
    });

    // Assert
    expect(res.success).toBe(false);
    expect(res.error).toContain('مستخدم مسبقاً');
    expect(mockRepo.createSite).not.toHaveBeenCalled();
  });
});
