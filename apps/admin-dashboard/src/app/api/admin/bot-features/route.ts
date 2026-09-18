import { NextResponse } from 'next/server';
import { prisma, BotNodeStatus, DisabledBehavior } from '@alsaada/database';
import { getCurrentUser } from '@/lib/auth';
import net from 'node:net';

const SYNC_CHANNEL = 'system:bot_menu_sync';

/**
 * Lightweight zero-dependency Redis publisher to notify bot-server of cache invalidation (< 2ms).
 */
async function notifyBotMenuSync(): Promise<void> {
  return new Promise((resolve) => {
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    let host = '127.0.0.1';
    let port = 6379;
    let password = '';
    try {
      const u = new URL(redisUrl);
      host = u.hostname || host;
      port = u.port ? parseInt(u.port, 10) : port;
      password = u.password || '';
    } catch {}

    const client = net.createConnection({ host, port, timeout: 1500 }, () => {
      if (password) {
        const authCmd = `*2\r\n$4\r\nAUTH\r\n$${Buffer.byteLength(password)}\r\n${password}\r\n`;
        client.write(authCmd);
      }
      const msg = JSON.stringify({ timestamp: Date.now() });
      const cmd = `*3\r\n$7\r\nPUBLISH\r\n$${Buffer.byteLength(SYNC_CHANNEL)}\r\n${SYNC_CHANNEL}\r\n$${Buffer.byteLength(msg)}\r\n${msg}\r\n`;
      client.write(cmd, () => {
        client.end();
        resolve();
      });
    });

    client.on('error', () => resolve());
    client.on('timeout', () => {
      client.destroy();
      resolve();
    });
  });
}

/**
 * GET /api/admin/bot-features
 * Retrieves full list of bot menu nodes, statistics, and snapshots.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح - يرجى تسجيل الدخول أولاً' }, { status: 401 });
    }

    const canManage = ['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(user.role);
    if (!canManage) {
      return NextResponse.json({ error: 'غير مصرح لك بإدارة وظائف وقوائم البوت' }, { status: 403 });
    }

    const nodes = await prisma.botMenuNode.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    const snapshots = await prisma.botMenuSnapshot.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, title: true, createdAt: true, createdById: true },
    });

    const totalNodes = nodes.length;
    const activeNodes = nodes.filter((n) => n.status === BotNodeStatus.ACTIVE).length;
    const disabledNodes = nodes.filter((n) => n.status === BotNodeStatus.DISABLED).length;
    const maintenanceNodes = nodes.filter((n) => n.status === BotNodeStatus.MAINTENANCE).length;

    return NextResponse.json({
      success: true,
      nodes,
      snapshots,
      stats: {
        totalNodes,
        activeNodes,
        disabledNodes,
        maintenanceNodes,
      },
    });
  } catch (error) {
    console.error('Failed to fetch bot features:', error);
    return NextResponse.json({ error: 'فشل في استرداد قائمة موديولات وتدفقات البوت' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/bot-features
 * Updates a single node (status, behavior, title, icon, maintenance message).
 * Supports cascading to children nodes if isCascade is true.
 */
export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    if (user.role !== 'SUPER_ADMIN' && user.role !== 'GENERAL_ADMIN') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const body = await request.json();
    const {
      id,
      status,
      disabledBehavior,
      maintenanceMessage,
      title,
      icon,
      allowedRoles,
      sortOrder,
      parentId,
      isCascade,
    } = body as {
      id: string;
      status?: BotNodeStatus;
      disabledBehavior?: DisabledBehavior;
      maintenanceMessage?: string;
      title?: string;
      icon?: string;
      allowedRoles?: string[];
      sortOrder?: number;
      parentId?: string | null;
      isCascade?: boolean;
    };

    if (!id) {
      return NextResponse.json({ error: 'معرف العنصر مطلوب' }, { status: 400 });
    }

    const targetNode = await prisma.botMenuNode.findUnique({ where: { id } });
    if (!targetNode) {
      return NextResponse.json({ error: 'العنصر غير موجود' }, { status: 404 });
    }

    // Sovereign Anchor Immutability Enforcement
    if (targetNode.isProtected && status && status !== BotNodeStatus.ACTIVE) {
      return NextResponse.json(
        { error: '❌ خطأ حوكمة: هذه وظيفة سيادية محصنة غير قابلة للإيقاف أو التعطيل مطلقاً.' },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (disabledBehavior !== undefined) updateData.disabledBehavior = disabledBehavior;
    if (maintenanceMessage !== undefined) updateData.maintenanceMessage = maintenanceMessage;
    if (title !== undefined) updateData.title = title;
    if (icon !== undefined) updateData.icon = icon;
    if (allowedRoles !== undefined) updateData.allowedRoles = allowedRoles;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (parentId !== undefined) updateData.parentId = parentId;

    const updatedNode = await prisma.botMenuNode.update({
      where: { id },
      data: updateData,
    });

    // Cascading updates to children
    if (isCascade && status) {
      const cascadeChildren = async (parentUuid: string) => {
        const children = await prisma.botMenuNode.findMany({ where: { parentId: parentUuid } });
        for (const child of children) {
          if (!child.isProtected) {
            await prisma.botMenuNode.update({
              where: { id: child.id },
              data: {
                status,
                ...(disabledBehavior ? { disabledBehavior } : {}),
                ...(maintenanceMessage ? { maintenanceMessage } : {}),
              },
            });
            await cascadeChildren(child.id);
          }
        }
      };
      await cascadeChildren(id);
    }

    await notifyBotMenuSync();

    return NextResponse.json({ success: true, node: updatedNode });
  } catch (error) {
    console.error('Failed to update bot feature:', error);
    return NextResponse.json({ error: 'فشل تحديث بيانات العنصر' }, { status: 500 });
  }
}

/**
 * POST /api/admin/bot-features
 * Handles bulk operations: reorder, bulk_status, create_snapshot, restore_snapshot.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    if (user.role !== 'SUPER_ADMIN' && user.role !== 'GENERAL_ADMIN') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body as { action: string };

    if (action === 'reorder') {
      const { items } = body as { items: Array<{ id: string; sortOrder: number; parentId?: string | null }> };
      if (!Array.isArray(items)) {
        return NextResponse.json({ error: 'قائمة العناصر غير صالحة' }, { status: 400 });
      }

      await prisma.$transaction(
        items.map((item) =>
          prisma.botMenuNode.update({
            where: { id: item.id },
            data: {
              sortOrder: item.sortOrder,
              ...(item.parentId !== undefined ? { parentId: item.parentId } : {}),
            },
          })
        )
      );

      await notifyBotMenuSync();
      return NextResponse.json({ success: true, count: items.length });
    }

    if (action === 'bulk_status') {
      const { ids, status, disabledBehavior, maintenanceMessage } = body as {
        ids: string[];
        status: BotNodeStatus;
        disabledBehavior?: DisabledBehavior;
        maintenanceMessage?: string;
      };

      if (!Array.isArray(ids) || ids.length === 0 || !status) {
        return NextResponse.json({ error: 'البيانات غير مكتملة' }, { status: 400 });
      }

      // Filter out sovereign protected nodes
      const nodes = await prisma.botMenuNode.findMany({
        where: { id: { in: ids } },
        select: { id: true, isProtected: true },
      });

      const eligibleIds = nodes
        .filter((n) => status === BotNodeStatus.ACTIVE || !n.isProtected)
        .map((n) => n.id);

      if (eligibleIds.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'كافة العناصر المحددة هي وظائف سيادية محصنة لا يمكن تعطيلها.',
        });
      }

      await prisma.botMenuNode.updateMany({
        where: { id: { in: eligibleIds } },
        data: {
          status,
          ...(disabledBehavior ? { disabledBehavior } : {}),
          ...(maintenanceMessage ? { maintenanceMessage } : {}),
        },
      });

      await notifyBotMenuSync();
      return NextResponse.json({ success: true, updatedCount: eligibleIds.length });
    }

    if (action === 'create_snapshot') {
      const { title } = body as { title?: string };
      const allNodes = await prisma.botMenuNode.findMany();

      const snapshot = await prisma.botMenuSnapshot.create({
        data: {
          title: title?.trim() || `لقطة تكوين - ${new Date().toLocaleString('ar-EG')}`,
          data: JSON.parse(JSON.stringify(allNodes)),
          createdById: user.id || 'system',
        },
      });

      return NextResponse.json({ success: true, snapshot });
    }

    if (action === 'restore_snapshot') {
      const { snapshotId } = body as { snapshotId: string };
      const snapshot = await prisma.botMenuSnapshot.findUnique({ where: { id: snapshotId } });
      if (!snapshot) {
        return NextResponse.json({ error: 'اللقطة غير موجودة' }, { status: 404 });
      }

      const snapshotNodes = snapshot.data as unknown as Array<{
        code: string;
        status: BotNodeStatus;
        disabledBehavior: DisabledBehavior;
        sortOrder: number;
        title: string;
        icon: string | null;
        maintenanceMessage: string | null;
      }>;

      if (Array.isArray(snapshotNodes)) {
        for (const sn of snapshotNodes) {
          // Sovereign protected nodes must remain ACTIVE even during snapshot rollback
          await prisma.botMenuNode.updateMany({
            where: {
              code: sn.code,
              ...(sn.status !== BotNodeStatus.ACTIVE ? { isProtected: false } : {}),
            },
            data: {
              status: sn.status,
              disabledBehavior: sn.disabledBehavior,
              sortOrder: sn.sortOrder,
              title: sn.title,
              icon: sn.icon,
              maintenanceMessage: sn.maintenanceMessage,
            },
          });
        }
      }

      await notifyBotMenuSync();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
  } catch (error) {
    console.error('Failed to execute bulk action:', error);
    return NextResponse.json({ error: 'فشل تنفيذ العملية المجمعة' }, { status: 500 });
  }
}
