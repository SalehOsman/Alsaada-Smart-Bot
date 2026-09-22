import { NextRequest, NextResponse } from 'next/server';
import { getModuleById, getDiscoveredFlows } from '@/lib/module-catalog';

interface RouteContext {
  params: Promise<{
    module: string;
    path?: string[];
  }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { module: moduleId, path } = await context.params;
  const moduleDef = getModuleById(moduleId);

  if (!moduleDef) {
    return NextResponse.json(
      { error: `Module "${moduleId}" not found in catalog.` },
      { status: 404 }
    );
  }

  const flows = getDiscoveredFlows(moduleId);
  const subPath = path && path.length > 0 ? path.join('/') : '';

  return NextResponse.json({
    ok: true,
    module: {
      id: moduleDef.id,
      version: moduleDef.version,
      titleArabic: moduleDef.titleArabic,
      category: moduleDef.category,
      status: moduleDef.status,
    },
    subPath,
    flowCount: flows.length,
    flows: flows.map((f) => ({
      id: f.id,
      slug: f.slug,
      titleArabic: f.titleArabic,
      status: f.status,
      allowedRoles: f.allowedRoles,
    })),
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { module: moduleId } = await context.params;
  const moduleDef = getModuleById(moduleId);

  if (!moduleDef) {
    return NextResponse.json(
      { error: `Module "${moduleId}" not found in catalog.` },
      { status: 404 }
    );
  }

  if (moduleDef.status === 'disabled') {
    return NextResponse.json(
      { error: `Module "${moduleId}" is disabled.` },
      { status: 403 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({
      ok: true,
      moduleId,
      message: `Executed extension route for module ${moduleId}`,
      received: body,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to process extension request: ${String(err)}` },
      { status: 500 }
    );
  }
}
