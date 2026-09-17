export interface SiteLookup {
  id: string;
  code: string;
  name: string;
  governorateCode?: string | null;
}

export interface JobTitleLookup {
  id: string;
  code: string;
  name: string;
  departmentId: string;
  departmentCode: string;
  baseSalary: number;
  additionalSalary: number;
  workDays: number;
  restDays: number;
  shiftNature: string;
}

export interface CanteenCigaretteLookup {
  id: string;
  code: string;
  name: string;
  sellingPrice: number;
  siteId: string;
}

export interface AccommodationLookup {
  id: string;
  unitNumber: string;
  unitType: string;
  capacity: number;
  currentOccupancy: number;
  siteId: string;
}

export const EGYPTIAN_GOVERNORATES: Record<string, string> = {
  '01': 'القاهرة',
  '02': 'الإسكندرية',
  '03': 'بورسعيد',
  '04': 'السويس',
  '11': 'دمياط',
  '12': 'الدقهلية',
  '13': 'الشرقية',
  '14': 'القليوبية',
  '15': 'كفر الشيخ',
  '16': 'الغربية',
  '17': 'المنوفية',
  '18': 'البحيرة',
  '19': 'الإسماعيلية',
  '21': 'الجيزة',
  '22': 'بني سويف',
  '23': 'الفيوم',
  '24': 'المنيا',
  '25': 'أسيوط',
  '26': 'سوهاج',
  '27': 'قنا',
  '28': 'أسوان',
  '29': 'الأقصر',
  '31': 'البحر الأحمر',
  '32': 'الوادي الجديد',
  '33': 'مطروح',
  '34': 'شمال سيناء',
  '35': 'جنوب سيناء',
  '88': 'خارج الجمهورية',
};

export const PAYMENT_METHODS = [
  { value: 'CASH_SITE', label: '💵 استلام نقدي بالخزينة / الموقع' },
  { value: 'VODAFONE_CASH', label: '📱 محفظة فودافون كاش' },
  { value: 'ORANGE_CASH', label: '📱 محفظة أورنج كاش' },
  { value: 'ETISALAT_CASH', label: '📱 محفظة اتصالات كاش' },
  { value: 'WE_PAY', label: '📱 محفظة وي باي (WE Pay)' },
  { value: 'INSTAPAY', label: '⚡ إنستاباي (InstaPay)' },
  { value: 'BANK_TRANSFER', label: '🏦 تحويل بنكي رسمي' },
  { value: 'POST_OFFICE', label: '📮 حساب هيئة البريد المصري' },
];

export const CONTRACT_TYPES = [
  { value: 'PERMANENT', label: '🟢 عمالة دائمة (افتراضي)' },
  { value: 'DAILY_LABOR', label: '🟡 عمالة يومية / حرة' },
  { value: 'SEASONAL', label: '🔵 تعاقد موسمي / مشروع' },
];

export const MILITARY_STATUSES = [
  { value: 'أدى الخدمة العسكرية (قدوة حسنة)', label: '🎖️ أدى الخدمة العسكرية (قدوة حسنة)' },
  { value: 'إعفاء نهائي', label: '🛡️ إعفاء نهائي' },
  { value: 'إعفاء مؤقت', label: '⏳ إعفاء مؤقت' },
  { value: 'تأجيل دراسي', label: '📑 تأجيل دراسي' },
  { value: 'غير مطلوب / معافى طبياً', label: '🚫 غير مطلوب / معافى طبياً' },
  { value: 'لم يتم التقدم للخدمة العسكرية', label: '⚪ لم يتم التقدم للخدمة العسكرية' },
];

export const DRIVING_LICENSES = [
  { value: 'لا توجد رخصة قيادة', label: '🚫 لا توجد رخصة قيادة' },
  { value: 'رخصة خاصة', label: '🚗 رخصة خاصة' },
  { value: 'مهنية درجة أولى', label: '🚛 مهنية درجة أولى' },
  { value: 'مهنية درجة ثانية', label: '🚚 مهنية درجة ثانية' },
  { value: 'مهنية درجة ثالثة', label: '🚐 مهنية درجة ثالثة' },
  { value: 'رخصة تشغيل معدات ثقيلة', label: '🚜 رخصة تشغيل معدات ثقيلة' },
];

export const MARITAL_STATUSES = [
  { value: 'أعزب', label: '💍 أعزب' },
  { value: 'متزوج', label: '💍 متزوج' },
  { value: 'متزوج ويعول', label: '👨‍👩‍👧‍👦 متزوج ويعول' },
  { value: 'مطلق', label: '💍 مطلق' },
  { value: 'أرمل', label: '💍 أرمل' },
];

export const INSURANCE_STATUSES = [
  { value: 'غير مؤمن عليه بجهة أخرى', label: '⚪ غير مؤمن عليه بجهة أخرى' },
  { value: 'مؤمن عليه بجهة سابقة', label: '🟢 مؤمن عليه بجهة سابقة' },
  { value: 'متفرغ تماماً وبدون تأمين', label: '🔴 متفرغ تماماً وبدون تأمين' },
];

export const CANTEEN_CIGARETTE_POLICIES = [
  { value: 'NONE', label: '🚫 لا يصرف سجائر' },
  { value: 'ONE_PACK_DAILY', label: '📦 علبة يومياً (30 علبة/شهر)' },
  { value: 'FULL_COVERAGE', label: '🔥 تغطية كاملة' },
  { value: 'CUSTOM', label: '⚙️ سياسة مخصصة' },
];

export const PPE_SHOE_SIZES = ['41', '42', '43', '44', '45', '46'];
export const PPE_UNIFORM_SIZES = ['M', 'L', 'XL', 'XXL', '3XL', '4XL'];
