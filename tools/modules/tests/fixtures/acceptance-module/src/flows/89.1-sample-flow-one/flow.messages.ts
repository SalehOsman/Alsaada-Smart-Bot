export const SampleMessages = {
  welcome: '🧪 مرحبًا بك في تدفق العينة التجريبي (89.1).\nيرجى إدخال اسم العملية:',
  confirmCard: (title: string, amount: number) =>
    `📋 *بطاقة تأكيد العملية*\n\nالاسم: ${title}\nالمبلغ: ${amount.toLocaleString()} ج.م\n\nهل تؤكد التنفيذ؟`,
  success: (id: string) => `✅ تم إنشاء السجل التجريبي بنجاح!\nالمعرف: \`${id}\``,
  unauthorized: '⛔ غير مصرح لك بتنفيذ هذه العملية.',
  invalidAmount: '❌ يرجى إدخال مبلغ صحيح أكبر من الصفر.',
};
