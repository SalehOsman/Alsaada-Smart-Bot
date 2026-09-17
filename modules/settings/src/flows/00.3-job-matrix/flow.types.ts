export interface DepartmentDto {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  jobsCount: number;
  activeJobsCount: number;
}

export interface JobTitleDto {
  id: string;
  code: string;
  title: string;
  departmentId: string;
  departmentName?: string;
  departmentCode?: string;
  isActive: boolean;
  minHeadcount: number;
  baseSalary: number;
  allowance: number;
  workDays: number;
  restDays: number;
  workerCount?: number;
}

export interface ShiftCycleOption {
  workDays: number;
  restDays: number;
  totalCycleDays: number;
  shiftNature: string;
}

export type CycleTransitionPolicy =
  | 'IMMEDIATE_PRO_RATA'
  | 'IMMEDIATE_FULL'
  | 'NEXT_CYCLE_START'
  | 'CUSTOM_DATE'
  | 'NEW_HIRES_ONLY'
  | 'NEXT_CYCLE';

export interface JobMatrixEditState {
  type:
    | 'DEPT_NAME'
    | 'DEPT_CODE'
    | 'JOB_TITLE'
    | 'JOB_CODE'
    | 'JOB_SALARY'
    | 'JOB_ADDITIONAL_SALARY'
    | 'ADD_DEPT'
    | 'ADD_JOB'
    | 'SET_WD'
    | 'SET_RD';
  deptCode?: string | undefined;
  jobCode?: string | undefined;
  pendingAmount?: number | undefined;
  promptMessageId?: number | undefined;
  timestamp?: number | undefined;
}

export interface MatrixImportRow {
  deptCode: string;
  deptName: string;
  jobCode: string;
  jobTitle: string;
  baseSalary: number;
  additionalSalary: number;
  workDays: number;
  restDays: number;
  minHeadcount: number;
}

export interface MatrixImportResult {
  success: boolean;
  departmentsUpserted: number;
  jobsUpserted: number;
  errors: string[];
}
