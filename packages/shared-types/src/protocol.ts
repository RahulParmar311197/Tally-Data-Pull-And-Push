export type ConnectorAuth = {
  type: 'AUTH';
  deviceId: string;
  deviceName: string;
  token: string;
};

export type Heartbeat = { type: 'HEARTBEAT' };
export type TallyCompany = { type: 'TALLY_COMPANY'; company: string | null };

export type TallyReadOperation = 'current_company' | 'trial_balance';
export type TallyReadRequest = {
  type: 'TALLY_READ';
  requestId: string;
  operation: TallyReadOperation;
};
export type TallyReadResponse = {
  type: 'TALLY_READ_RESULT';
  requestId: string;
  operation: TallyReadOperation;
  ok: boolean;
  data?: unknown;
  error?: string;
};

export type ConnectorMessage = ConnectorAuth | Heartbeat | TallyCompany | TallyReadResponse;
export type ApiToConnectorMessage = TallyReadRequest;

export type ConnectorStatus = {
  deviceId: string;
  name: string;
  connectedAt: number;
  lastSeen: number;
  company: string | null;
  status: 'online' | 'offline';
};
