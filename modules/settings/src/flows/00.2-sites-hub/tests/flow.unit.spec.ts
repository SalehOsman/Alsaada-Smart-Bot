import { describe, it, expect, vi } from 'vitest';
import { SitesHubService } from '../flow.service.js';
import type { SitesHubRepository } from '../flow.repository.js';
import type { SiteDto } from '../flow.types.js';

describe('Flow 00.2 Unit Tests — SitesHub', () => {
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

  it('should list sites correctly', async () => {
    const mockRepo = {
      listSites: vi.fn().mockResolvedValue(sampleSites),
    } as unknown as SitesHubRepository;

    const service = new SitesHubService(mockRepo);
    const sites = await service.listSites();

    expect(sites).toHaveLength(2);
    expect(sites[0]!.name).toBe('موقع السويس للإنشاءات');
    expect(mockRepo.listSites).toHaveBeenCalledTimes(1);
  });

  it('should generate next suggested site code correctly', async () => {
    const mockRepo = {
      listSites: vi.fn().mockResolvedValue(sampleSites),
    } as unknown as SitesHubRepository;

    const service = new SitesHubService(mockRepo);
    const nextCode = await service.getNextSuggestedCode();

    expect(nextCode).toBe('STE-03');
  });

  it('should toggle site status', async () => {
    const mockRepo = {
      toggleSiteStatus: vi.fn().mockResolvedValue({
        ...sampleSites[0],
        status: 'PAUSED',
      }),
    } as unknown as SitesHubRepository;

    const service = new SitesHubService(mockRepo);
    const updated = await service.toggleSiteStatus('STE-01');

    expect(updated.status).toBe('PAUSED');
    expect(mockRepo.toggleSiteStatus).toHaveBeenCalledWith('STE-01');
  });

  it('should prevent creating site with duplicate code', async () => {
    const mockRepo = {
      getSiteByCode: vi.fn().mockResolvedValue(sampleSites[0]),
      createSite: vi.fn(),
    } as unknown as SitesHubRepository;

    const service = new SitesHubService(mockRepo);
    const res = await service.createSite({
      name: 'موقع جديد',
      code: 'STE-01',
      geofenceRadiusMeters: 250,
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('مستخدم مسبقاً');
    expect(mockRepo.createSite).not.toHaveBeenCalled();
  });
});
