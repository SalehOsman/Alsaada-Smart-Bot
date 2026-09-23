import { prisma, disconnectDatabase } from '../client.js';
import type { DatabaseClient } from '../client.js';
import { BotNodeType, BotNodeStatus, DisabledBehavior } from '../generated/client/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  process.loadEnvFile('.env');
} catch {}

function findModulesDirectory(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'modules'),
    path.resolve(process.cwd(), '../../modules'),
    path.resolve(__dirname, '../../../../modules'),
    path.resolve(__dirname, '../../../modules'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

export async function seedBotMenuCatalog(prismaInstance?: DatabaseClient): Promise<{
  modulesCount: number;
  sectionsCount: number;
  flowsCount: number;
}> {
  const client = prismaInstance ?? prisma;
  console.log('================================================================');
  console.log('🤖 Auto-Discovering & Seeding Active Bot Menu Catalog...');
  console.log('================================================================');

  try {
    const modulesDir = findModulesDirectory();
    if (!modulesDir || !fs.existsSync(modulesDir)) {
      console.warn('⚠️ Modules directory not found at any candidate path.');
      return { modulesCount: 0, sectionsCount: 0, flowsCount: 0 };
    }

    const validCodes = new Set<string>();
    const moduleEntries = fs.readdirSync(modulesDir, { withFileTypes: true });
    moduleEntries.sort((a, b) => a.name.localeCompare(b.name));

    let modulesCount = 0;
    let flowsCount = 0;

    for (const modDirent of moduleEntries) {
      if (!modDirent.isDirectory()) continue;
      const modName = modDirent.name;
      const modDir = path.join(modulesDir, modName);
      const contractPath = path.join(modDir, 'module.contract.json');
      if (!fs.existsSync(contractPath)) continue;

      let contract: any = {};
      try {
        contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
      } catch {
        continue;
      }

      // Determine module code, title, icon and callback
      let modCode = `mod:${modName}`;
      let modTitle = contract.displayName || contract.titleArabic || modName;
      let modIcon = '📦';
      let modCallback = `menu:domain:${modName}`;
      let isProtected = Boolean(contract.critical);
      let allowedRoles = ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'];

      if (modName === 'workforce') {
        modCode = 'mod:hr';
        modTitle = contract.displayName || 'قطاع الموارد البشرية وشؤون العاملين';
        modIcon = '👥';
        modCallback = 'menu:domain:hr';
        allowedRoles = ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'];
      } else if (modName === 'settings') {
        modCode = 'mod:governance';
        modTitle = contract.displayName || 'قطاع الإعدادات السيادية والإدارة العامة';
        modIcon = '⚙️';
        modCallback = 'menu:domain:governance';
        isProtected = true;
        allowedRoles = ['SUPER_ADMIN'];
      }

      validCodes.add(modCode);

      const modNode = await client.botMenuNode.upsert({
        where: { code: modCode },
        update: {
          title: modTitle,
          icon: modIcon,
          callbackData: modCallback,
          isProtected,
          allowedRoles,
        },
        create: {
          code: modCode,
          type: BotNodeType.MODULE,
          title: modTitle,
          icon: modIcon,
          callbackData: modCallback,
          sortOrder: modName === 'workforce' ? 10 : 20,
          isProtected,
          status: BotNodeStatus.ACTIVE,
          disabledBehavior: DisabledBehavior.LOCK_WITH_ALERT,
          allowedRoles,
        },
      });
      modulesCount++;

      // Scan flows within this module
      const flowsDir = path.join(modDir, 'src', 'flows');
      if (fs.existsSync(flowsDir)) {
        const flowEntries = fs.readdirSync(flowsDir, { withFileTypes: true });
        flowEntries.sort((a, b) => a.name.localeCompare(b.name));

        for (let i = 0; i < flowEntries.length; i++) {
          const flowDirent = flowEntries[i];
          if (!flowDirent || !flowDirent.isDirectory()) continue;
          const flowDir = path.join(flowsDir, flowDirent.name);
          const flowContractPath = path.join(flowDir, 'flow.contract.json');
          if (!fs.existsSync(flowContractPath)) continue;

          try {
            const flowContract = JSON.parse(fs.readFileSync(flowContractPath, 'utf8'));
            const flowId = flowContract.id || flowContract.flowCode || flowDirent.name.split('-')[0];
            const flowCode = `flow:${flowId}`;
            validCodes.add(flowCode);

            const flowTitle = flowContract.titleArabic || flowContract.flowName || flowDirent.name;
            const flowCallback = flowContract.menuButton?.callbackData || `${flowCode}:start`;
            const flowRoles = Array.isArray(flowContract.allowedRoles) ? flowContract.allowedRoles : allowedRoles;
            const flowProtected = Boolean(flowContract.isProtected || modName === 'settings');

            await client.botMenuNode.upsert({
              where: { code: flowCode },
              update: {
                parentId: modNode.id,
                title: flowTitle,
                callbackData: flowCallback,
                isProtected: flowProtected,
                allowedRoles: flowRoles,
              },
              create: {
                code: flowCode,
                parentId: modNode.id,
                type: BotNodeType.FLOW,
                title: flowTitle,
                icon: flowProtected ? '🛡️' : '⚡',
                sortOrder: i + 1,
                isProtected: flowProtected,
                callbackData: flowCallback,
                status: BotNodeStatus.ACTIVE,
                disabledBehavior: DisabledBehavior.LOCK_WITH_ALERT,
                allowedRoles: flowRoles,
                metadata: {
                  module: modName,
                  flowId,
                },
              },
            });
            flowsCount++;
          } catch {
            // skip invalid flow contract
          }
        }
      }
    }

    // Purge all phantom legacy nodes not part of active discovered monorepo modules/flows
    const deleted = await client.botMenuNode.deleteMany({
      where: {
        code: {
          notIn: Array.from(validCodes),
        },
      },
    });

    if (deleted.count > 0) {
      console.log(`🧹 Cleaned out ${deleted.count} legacy/phantom menu node(s) from database.`);
    }

    console.log(`✅ [SEED COMPLETE] Bot Menu Catalog synced with ${modulesCount} modules and ${flowsCount} flows.`);

    // Create Initial Snapshot for Rollback protection if none exists
    const existingSnapshot = await client.botMenuSnapshot.findFirst({
      where: { title: 'الترتيب الافتراضي المعتمد للمنظومة' },
    });

    if (!existingSnapshot) {
      const allNodes = await client.botMenuNode.findMany({
        orderBy: { sortOrder: 'asc' },
      });
      await client.botMenuSnapshot.create({
        data: {
          title: 'الترتيب الافتراضي المعتمد للمنظومة',
          data: allNodes as any,
          createdById: 'SYSTEM_BOOTSTRAP',
        },
      });
      console.log('✅ [SNAPSHOT] Default baseline snapshot created successfully.');
    }

    return {
      modulesCount,
      sectionsCount: 0,
      flowsCount,
    };
  } finally {
    if (!prismaInstance) {
      await disconnectDatabase();
    }
  }
}

if (process.argv[1]?.endsWith('seed-bot-menu-catalog.ts')) {
  seedBotMenuCatalog()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ [SEED FATAL]:', err);
      process.exit(1);
    });
}
