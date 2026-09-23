/**
 * Shared services for sandbox module.
 */

export class SandboxService {
  constructor(private readonly runtime?: unknown) {}

  async getModuleHealth(): Promise<{ status: string; uptime: number }> {
    return { status: 'healthy', uptime: process.uptime() };
  }
}
