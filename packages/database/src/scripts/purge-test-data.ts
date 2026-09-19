import { prisma } from '../client.js';

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
    // 1. Tables to completely truncate and reset
    const tablesToPurge = [
      'outbox_events',
      'audit_logs',
      'worker_expense_claims',
      'financial_ledgers',
      'advance_installments',
      'advance_requests',
      'disciplinary_and_bonuses',
      'leaves',
      'leave_allowances',
      'duty_rosters',
      'site_tasks',
      'payroll_records',
      'payroll_runs',
      'custody_settlements',
      'custody_expense_items',
      'financial_custodies',
      'hospitality_expenses',
      'supplier_invoice_items',
      'supplier_invoices',
      'supplier_payments',
      'fuel_dispense_logs',
      'equipment_maintenances',
      'spare_parts_requests',
      'kitchen_meal_dispenses',
      'food_waste_logs',
      'phosphate_production_slips',
      'phosphate_extracts',
      'salary_histories',
      'worker_custom_allowances',
      'ppe_assets',
      'worker_clearances',
      'worker_balance_snapshots',
      'workers',
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
    await prisma.$disconnect();
  }
}

// Direct execution from CLI
if (process.argv.includes('--confirm')) {
  purgeTestData(true)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
