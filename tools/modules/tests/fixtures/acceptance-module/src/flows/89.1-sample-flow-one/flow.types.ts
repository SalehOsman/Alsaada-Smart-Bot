export interface SampleFlowState {
  title: string;
  amount: number;
  step: 'IDLE' | 'AWAIT_AMOUNT' | 'CONFIRM';
}

export interface SampleDomainDTO {
  id: string;
  title: string;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}
