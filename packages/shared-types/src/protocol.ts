export type ConnectorAuth = {
  type: 'AUTH';
  deviceId: string;
  deviceName: string;
  token: string;
};

export type Heartbeat = { type: 'HEARTBEAT' };
export type TallyCompany = { type: 'TALLY_COMPANY'; company: string | null };
export type ConnectorMessage = ConnectorAuth | Heartbeat | TallyCompany;

export type ConnectorStatus = {
  deviceId: string;
  name: string;
  connectedAt: number;
  lastSeen: number;
  company: string | null;
  status: 'online' | 'offline';
};
