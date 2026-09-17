import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../../../lib/auth';
import { studioProcessManager } from '../../../../../../lib/studio-process';
import { TelemetryLogger } from '@alsaada/telemetry';

const logger = new TelemetryLogger({
  service: 'admin-dashboard',
  defaultComponent: 'prisma-studio-proxy',
});

interface RouteParams {
  params: Promise<{ path?: string[] }>;
}

async function handleProxy(req: NextRequest, { params }: RouteParams) {
  // 1. Strict RBAC Boundary: Exclusively SUPER_ADMIN
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'يرجى تسجيل الدخول أولاً للوصول إلى استوديو قاعدة البيانات' },
      { status: 401 }
    );
  }

  if (user.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'غير مصرح - قمرة استوديو قاعدة البيانات مخصصة حصرياً للسوبر أدمن' },
      { status: 403 }
    );
  }

  // 2. Touch 15-minute inactivity watchdog on every active request
  studioProcessManager.touch();

  // 3. Construct upstream target URL
  const resolvedParams = await params;
  const pathSegments = resolvedParams?.path || [];
  const subPath = Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments || '';
  const search = req.nextUrl.search || '';
  const upstreamBase = studioProcessManager.getTargetUrl().replace(/\/+$/, '');
  const targetUrl = subPath ? `${upstreamBase}/${subPath}${search}` : `${upstreamBase}/${search}`;

  // 4. Forward headers cleanly
  const forwardHeaders = new Headers();
  req.headers.forEach((val, key) => {
    const lower = key.toLowerCase();
    if (
      lower !== 'host' &&
      lower !== 'connection' &&
      lower !== 'keep-alive' &&
      lower !== 'content-length' &&
      lower !== 'transfer-encoding'
    ) {
      forwardHeaders.set(key, val);
    }
  });

  forwardHeaders.set('x-forwarded-host', req.headers.get('host') || 'localhost');
  forwardHeaders.set('x-forwarded-proto', 'https');
  forwardHeaders.set('ngrok-skip-browser-warning', 'true');

  try {
    const hasBody = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    const bodyBuffer = hasBody ? await req.arrayBuffer() : undefined;

    const upstreamRes = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body: bodyBuffer,
      // @ts-expect-error Node.js duplex stream option for fetch
      duplex: hasBody ? 'half' : undefined,
    });

    const contentType = upstreamRes.headers.get('content-type') || '';

    // If HTML, inject <base> tag and rewrite root-relative asset paths to prevent 404s
    if (contentType.includes('text/html')) {
      let html = await upstreamRes.text();

      // Inject base tag for relative links
      if (html.includes('<head>')) {
        html = html.replace('<head>', '<head><base href="/api/admin/studio/proxy/" />');
      } else if (html.includes('<head ')) {
        html = html.replace(/<head\b[^>]*>/, '$&<base href="/api/admin/studio/proxy/" />');
      }

      // Rewrite root-relative links to proxy path
      html = html
        .replace(/src="\/(?!\/|api\/admin\/studio\/proxy)/g, 'src="/api/admin/studio/proxy/')
        .replace(/href="\/(?!\/|api\/admin\/studio\/proxy)/g, 'href="/api/admin/studio/proxy/');

      const resHeaders = new Headers(upstreamRes.headers);
      resHeaders.delete('content-length');
      resHeaders.delete('content-encoding');
      resHeaders.set('content-type', 'text/html; charset=utf-8');

      return new NextResponse(html, {
        status: upstreamRes.status,
        headers: resHeaders,
      });
    }

    // If JavaScript, rewrite hardcoded upstream API path to internal reverse proxy
    if (contentType.includes('javascript')) {
      let js = await upstreamRes.text();
      js = js.replaceAll(
        '${window.location.origin}/api',
        '${window.location.origin}/api/admin/studio/proxy/api'
      );

      const resHeaders = new Headers(upstreamRes.headers);
      resHeaders.delete('content-length');
      resHeaders.delete('content-encoding');
      resHeaders.set('content-type', contentType);

      return new NextResponse(js, {
        status: upstreamRes.status,
        headers: resHeaders,
      });
    }

    // Binary / asset / JSON responses
    const resBody = await upstreamRes.arrayBuffer();
    const resHeaders = new Headers(upstreamRes.headers);
    resHeaders.delete('content-length');

    return new NextResponse(resBody, {
      status: upstreamRes.status,
      headers: resHeaders,
    });
  } catch (err) {
    logger.warn('Upstream Prisma Studio connection failed (offline or starting)', {
      payload: { targetUrl },
      error: err,
    });

    const isHtml = req.headers.get('accept')?.includes('text/html');
    if (isHtml) {
      const offlineHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>استوديو قاعدة البيانات متوقف</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #1e293b; padding: 2.5rem; border-radius: 1rem; border: 1px solid #334155; text-align: center; max-width: 480px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    h1 { font-size: 1.25rem; color: #f97316; margin-bottom: 0.75rem; }
    p { font-size: 0.875rem; color: #94a3b8; line-height: 1.6; margin-bottom: 1.5rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>استوديو قاعدة البيانات متوقف حالياً</h1>
    <p>خدمة Prisma Studio غير نشطة للحفاظ على موارد الخادم واتصالات PostgreSQL. يرجى تشغيل الخدمة من شريط أدوات قمرة القيادة.</p>
  </div>
</body>
</html>`;
      return new NextResponse(offlineHtml, {
        status: 503,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }

    return NextResponse.json(
      {
        error: 'STUDIO_OFFLINE',
        message: 'استوديو قاعدة البيانات متوقف حالياً. يرجى تشغيله من قمرة التحكم.',
      },
      { status: 503 }
    );
  }
}

export async function GET(req: NextRequest, ctx: RouteParams) {
  return handleProxy(req, ctx);
}

export async function POST(req: NextRequest, ctx: RouteParams) {
  return handleProxy(req, ctx);
}

export async function PUT(req: NextRequest, ctx: RouteParams) {
  return handleProxy(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: RouteParams) {
  return handleProxy(req, ctx);
}

export async function PATCH(req: NextRequest, ctx: RouteParams) {
  return handleProxy(req, ctx);
}

export async function HEAD(req: NextRequest, ctx: RouteParams) {
  return handleProxy(req, ctx);
}

export async function OPTIONS(req: NextRequest, ctx: RouteParams) {
  return handleProxy(req, ctx);
}
