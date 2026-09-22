import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../src/app/api/extensions/[module]/[[...path]]/route';

describe('Work Plan 89 — Dashboard Dynamic API Extensions (Phase P4)', () => {
  it('handles GET request for known active module and returns 200 with module metadata', async () => {
    const req = new NextRequest('http://localhost:3000/api/extensions/settings');
    const context = {
      params: Promise.resolve({ module: 'settings' }),
    };

    const res = await GET(req, context);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.module.id).toBe('settings');
    expect(data.module.titleArabic).toBeDefined();
  });

  it('handles GET request for non-existent module and returns 404', async () => {
    const req = new NextRequest('http://localhost:3000/api/extensions/unknown-module-xyz');
    const context = {
      params: Promise.resolve({ module: 'unknown-module-xyz' }),
    };

    const res = await GET(req, context);
    expect(res.status).toBe(404);

    const data = await res.json();
    expect(data.error).toContain('not found');
  });

  it('handles POST request execution on known module', async () => {
    const req = new NextRequest('http://localhost:3000/api/extensions/settings', {
      method: 'POST',
      body: JSON.stringify({ action: 'test_ping' }),
    });
    const context = {
      params: Promise.resolve({ module: 'settings' }),
    };

    const res = await POST(req, context);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.moduleId).toBe('settings');
    expect(data.received.action).toBe('test_ping');
  });
});
