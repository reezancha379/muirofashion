export type RecordStatus = 'active' | 'inactive';

export interface AffiliateProgram {
  id: string;
  name: string;
  network: string;
  website: string;
  defaultCommissionRate: number;
  disclosure?: string;
  status: RecordStatus;
}

export interface Merchant {
  id: string;
  name: string;
  website: string;
  affiliateProgramId?: string;
  status: RecordStatus;
}
