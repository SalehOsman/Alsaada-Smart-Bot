import type { Bot } from 'grammy';
import type { MyContext } from '../types/context.js';
import {
  handleWorkerPayslipHears,
  handleWorkerStatementHears,
  type WorkforceModuleContext,
} from '@alsaada/workforce';
import { handleSupplierInvoicesHears } from '@alsaada/settings';
import { systemDataService } from '../services/system-data.service.js';

/**
 * Registers business reply button hears routes (worker payslips, statements, and supplier invoices).
 * Decoupled from bot.ts shell to preserve microkernel purity and satisfy INV-6 (WP 114).
 */
export function registerBusinessHearsRoutes(bot: Bot<MyContext>): void {
  bot.hears(/قسيمة راتبي/, async (ctx) => {
    await handleWorkerPayslipHears(ctx as unknown as WorkforceModuleContext, systemDataService.getDbClient());
  });

  bot.hears(/كشف حسابي/, async (ctx) => {
    await handleWorkerStatementHears(ctx as unknown as WorkforceModuleContext, systemDataService.getDbClient());
  });

  bot.hears(/فواتيري ومستخلصاتي/, async (ctx) => {
    await handleSupplierInvoicesHears(ctx, systemDataService.getDbClient());
  });
}
