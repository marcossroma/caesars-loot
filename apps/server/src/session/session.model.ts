export interface DemoSessionModel {
  id: string;
  demoCredits: number;
  createdAt: Date;
  updatedAt: Date;
  lastSeenAt: Date;
  status: 'active' | 'expired';
}
