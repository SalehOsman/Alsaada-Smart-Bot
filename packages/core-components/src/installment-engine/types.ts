export interface InstallmentPlanParams {
  workerId: string;
  totalAmount: number;
  installmentsCount: number;
  startCycleDate: Date;
  monthlySalary?: number;
  maxDeductionPercent?: number; // e.g. 40%
}

export interface SingleInstallment {
  installmentNumber: number;
  dueDate: string; // YYYY-MM-DD
  amount: number;
  status: 'SCHEDULED' | 'PAID' | 'POSTPONED';
}

export interface InstallmentPlanResult {
  isValid: boolean;
  totalAmount: number;
  installmentsCount: number;
  monthlySalary?: number | undefined;
  monthlyDeductionAmount: number;
  actualDeductionPercent?: number | undefined;
  exceedsSafeLimit: boolean;
  installments: SingleInstallment[];
  warningArabic?: string | undefined;
  errorArabic?: string | undefined;
}
