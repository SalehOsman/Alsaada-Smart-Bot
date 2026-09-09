export const WORKFORCE_MESSAGES = {
  UNAUTHORIZED: '🔒 عذراً، هذه الوظيفة مقتصرة على مسؤولي الإدارة والموارد البشرية المصرح لهم.',
  SUPER_ADMIN_ONLY: '🔒 هذه الوظيفة مقتصرة على المدير العام فقط.',
  INVALID_FILE_FORMAT: '⚠️ صيغة الملف غير مدعومة. يرجى إرسال ملف إكسيل بصيغة .xlsx معتمد.',
  OPERATION_FAILED: '❌ تعذر إتمام العملية حالياً. يرجى المحاولة لاحقاً.',
} as const;

export const SHIFT_SYSTEM_LABELS: Record<string, string> = {
  '20_WORK_10_REST': '20 يوم عمل / 10 أيام راحة',
  '24_WORK_6_REST': '24 يوم عمل / 6 أيام راحة',
  '6_WORK_1_REST': '6 أيام عمل / يوم راحة',
  CONTINUOUS: 'دوام مستمر',
  ROTATING: 'ورديات متغيرة',
};

export function formatShiftSystem(sys?: string | null): string {
  if (!sys) return 'غير محدد';
  if (SHIFT_SYSTEM_LABELS[sys]) return SHIFT_SYSTEM_LABELS[sys];
  return sys.replace(/_/g, ' ');
}

export function cleanMd(str?: string | null): string {
  if (!str) return '';
  return str.replace(/_/g, ' ');
}
