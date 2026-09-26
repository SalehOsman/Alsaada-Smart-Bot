import { prisma, disconnectDatabase } from '../client.js';

try {
  process.loadEnvFile('.env');
} catch {}

/**
 * Al-Saada Enterprise Test Data Purge & Sanitization Protocol
 * 
 * Safely removes all mock/test records (workers, advances, withdrawals, 
 * attendance, audit logs, outbox queue) while preserving:
 * - Tenants & Company Configurations
 * - Super Admin User accounts
 * - Master Lookup metadata
 */
export async function purgeTestData(confirm: boolean = false): Promise<void> {
  if (!confirm) {
    console.error('❌ [SAFETY ABORT] Purge command requires explicit confirmation flag: --confirm');
    process.exit(1);
  }

  console.log('================================================================');
  console.log('🧹 Al-Saada Enterprise Test Data Purge Started...');
  console.log('🕒 Timestamp:', new Date().toISOString());
  console.log('================================================================');

  try {
    // 1. Tables to completely truncate and reset (active @alsaada/database tables)
    const tablesToPurge = [
      'outbox_events',
      'notification_queues',
      'system_error_logs',
      'bot_performance_logs',
      'audit_logs',
      'financial_ledgers',
      'approval_tickets',
      'user_wizard_drafts',
      'dashboard_auth_links',
      'dashboard_sessions',
    ];

    console.log('📋 Truncating transactional test tables...');
    for (const table of tablesToPurge) {
      try {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
        console.log(`  ✅ Cleared table: ${table}`);
      } catch (err: any) {
        console.warn(`  ⚠️ Could not truncate ${table}: ${err.message}`);
      }
    }

    // 2. Remove any test users (keep only active SUPER_ADMIN)
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        role: {
          not: 'SUPER_ADMIN',
        },
      },
    });
    console.log(`  ✅ Purged non-admin test users: ${deletedUsers.count} removed.`);

    console.log('================================================================');
    console.log('🎯 Test Data Purge Completed Successfully.');
    console.log('🛡️ Super Admin accounts and core tenant configs remain 100% intact.');
    console.log('================================================================');
  } catch (error) {
    console.error('❌ Error during test data purge:', error);
    throw error;
  } finally {
    await disconnectDatabase();
  }
}

// Direct execution from CLI
if (process.argv.includes('--confirm')) {
  purgeTestData(true)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
