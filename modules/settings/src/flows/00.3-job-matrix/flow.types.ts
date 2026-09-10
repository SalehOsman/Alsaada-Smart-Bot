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

export type CycleTransitionPolicy =
  | 'IMMEDIATE_PRO_RATA'
  | 'IMMEDIATE_FULL'
  | 'NEXT_CYCLE_START'
  | 'CUSTOM_DATE';

export interface JobMatrixEditState {
  type: 'DEPT_NAME' | 'DEPT_CODE' | 'JOB_TITLE' | 'JOB_CODE' | 'JOB_SALARY' | 'ADD_DEPT' | 'ADD_JOB' | 'SET_WD' | 'SET_RD';
  deptCode?: string;
  jobCode?: string;
  promptMessageId: number;
  timestamp: number;
}
