export type EditableWorkerField =
  | 'legacyCode'
  | 'name'
  | 'nickname'
  | 'phone'
  | 'emergencyPhone'
  | 'walletNumber'
  | 'idCardExpiryDate'
  | 'governorateCode'
  | 'address'
  | 'drivingLicense'
  | 'militaryStatus'
  | 'maritalStatus';

export interface CreateEditRequestInput {
  workerId: string;
  workerCode: string;
  workerName: string;
  requesterTelegramId: bigint;
  requesterName: string;
  requesterRole: string;
  fieldKey: EditableWorkerField;
  fieldName: string;
  oldValue?: string;
  newValue: string;
  reason?: string;
}

export interface EditExecutionResult {
  success: boolean;
  workerCode?: string;
  fieldName?: string;
  newValue?: string;
  isDirectExecution: boolean;
  ticketId?: string;
  error?: string;
}

export interface PendingEditTicket {
  id: string;
  requestId: string;
  workerId: string;
  workerCode: string;
  workerName: string;
  requesterName: string;
  requesterRole: string;
  fieldKey: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  reason: string;
  createdAt: Date;
}

export interface PendingWorkerEditState {
  workerId: string;
  workerCode: string;
  workerName: string;
  fieldKey?: EditableWorkerField;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  isSuperAdmin: boolean;
}
