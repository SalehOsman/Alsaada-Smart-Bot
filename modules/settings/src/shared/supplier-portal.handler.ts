import {
  formatBreadcrumbs,
  formatSpoiler,
  buildRichPage,
  richParagraph,
  assertRichMessage,
} from '@alsaada/core-components';

const SUPPLIER_CRUMBS = ['🏢 بوابة الموردين', '🧾 فواتيري ومستخلصاتي'];

export async function handleSupplierInvoicesHears(ctx: any, dbClient?: any): Promise<void> {
  const prisma = dbClient ?? ctx.prisma;
  if (ctx.effectiveRole !== 'SUPPLIER') {
    const deniedText =
      formatBreadcrumbs(SUPPLIER_CRUMBS) +
      '⚠️ *عذراً، هذه البوابة مخصصة للموردين المعتمدين فقط.*';
    const richMsg = buildRichPage({
      title: 'بوابة مستخلصات الموردين',
      blocks: [richParagraph(deniedText)],
    });
    assertRichMessage(richMsg);
    await ctx.reply(deniedText, { parse_mode: 'Markdown' });
    return;
  }

  if (!ctx.from?.id || !prisma?.supplier) return;

  const supplier = await prisma.supplier.findUnique({
    where: { telegramId: BigInt(ctx.from.id) },
    include: { invoices: { take: 5, orderBy: { invoiceDate: 'desc' } } },
  });

  if (!supplier) {
    const notLinkedText =
      formatBreadcrumbs(SUPPLIER_CRUMBS) +
      '⚠️ *عذراً، حسابك غير مرتبط بملف مورد.*';
    const richMsg = buildRichPage({
      title: 'بوابة مستخلصات الموردين',
      blocks: [richParagraph(notLinkedText)],
    });
    assertRichMessage(richMsg);
    await ctx.reply(notLinkedText, { parse_mode: 'Markdown' });
    return;
  }

  if (!supplier.invoices || supplier.invoices.length === 0) {
    const emptyText =
      formatBreadcrumbs(SUPPLIER_CRUMBS) +
      '🧾 *بوابة مستخلصات الموردين*\n\nلا توجد فواتير مسجلة للمراجعة.';
    const richMsg = buildRichPage({
      title: 'بوابة مستخلصات الموردين',
      blocks: [richParagraph(emptyText)],
    });
    assertRichMessage(richMsg);
    await ctx.reply(emptyText, { parse_mode: 'Markdown' });
    return;
  }

  let text = formatBreadcrumbs(SUPPLIER_CRUMBS) + `🧾 *بوابة مستخلصات الموردين*\n\n`;
  for (const inv of supplier.invoices) {
    const date = inv.invoiceDate instanceof Date
      ? inv.invoiceDate.toISOString().split('T')[0]
      : String(inv.invoiceDate).split('T')[0];
    const maskedTotal = formatSpoiler(`${inv.totalAmount} ج.م`, 'markdown');
    text += `فاتورة: ${inv.invoiceNumber} | التاريخ: ${date} | الإجمالي: ${maskedTotal} | الحالة: ${inv.paymentStatus}\n`;
  }

  const richMsg = buildRichPage({
    title: 'بوابة مستخلصات الموردين',
    blocks: [richParagraph(text)],
  });
  assertRichMessage(richMsg);

  await ctx.reply(text, { parse_mode: 'Markdown' });
}
