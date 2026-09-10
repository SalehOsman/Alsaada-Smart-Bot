export type EditablePersonalField =
  | 'phone'
  | 'emergencyContactName'
  | 'emergencyPhone'
  | 'address'
  | 'walletType'
  | 'accountNumber'
  | 'walletOwnerName'
  | 'instaPayHandle'
  | 'maritalStatus'
  | 'ppeShoeSize'
  | 'ppeUniformSize';

export const EDITABLE_FIELD_LABELS: Record<EditablePersonalField, string> = {
  phone: '📱 رقم الهاتف الشخصي',
  emergencyContactName: '👤 اسم جهة الاتصال للطوارئ',
  emergencyPhone: '📞 هاتف الطوارئ البديل',
  address: '🏠 محل الإقامة والعنوان',
  walletType: '💳 نوع المحفظة الإلكترونية',
  accountNumber: '🔢 رقم الحساب / المحفظة',
  walletOwnerName: '📝 اسم صاحب المحفظة',
  instaPayHandle: '⚡ معرف إنستاباي',
  maritalStatus: '💍 الحالة الاجتماعية',
  ppeShoeSize: '🥾 مقاس سيفتي شوز (PPE)',
  ppeUniformSize: '👕 مقاس الزي الميداني (PPE)',
};

export const FORBIDDEN_FINANCIAL_FIELDS = [
  'dailyWage',
  'basicSalary',
  'fixedAllowances',
  'jobTitle',
  'siteId',
  'shiftSystem',
  'insuranceNumber',
  'status',
] as const;

export interface WorkerSelfEditState {
  step: 'INIT' | 'FIELD_SELECT' | 'INPUT' | 'CONFIRM' | 'DONE';
  workerId: string;
  workerCode: string;
  workerName: string;
  selectedField?: EditablePersonalField | undefined;
  oldValue?: string | undefined;
  newValue?: string | undefined;
  reason?: string | undefined;
  createdAt: number;
}

export interface WorkerSelfEditInput {
  workerId: string;
  workerCode: string;
  workerName: string;
  field: EditablePersonalField;
  newValue: string;
  reason?: string | undefined;
  actorTelegramId: bigint;
  updatePayload?: Record<string, string> | undefined;
}

export interface WorkerSelfEditResult {
  success: boolean;
  referenceId: string;
  ticketNumber?: string | undefined;
  message: string;
  updatedField: string;
  newValue: string;
}
