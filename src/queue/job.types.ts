export interface IDonationJob {
  begId: string;
  donorId: string;
  amount: number;
  isAnonymous: boolean;
  paymentReference: string;
  paymentMethod: string;
}

export interface IWithdrawalJob {
  withdrawalId: string;
  autoProcessed: boolean;
}

export interface INotificationJob {
  type: 'donation_received' | 'beg_funded' | 'message_received' | 'donor_replied' | 'beg_expiring';
  userId: string;
  data: Record<string, any>;
}

export interface IEmailJob {
  type: 'withdrawal_success' | 'withdrawal_failed' | 'withdrawal_pending' | 'welcome' | 'beg_expiring';
  to: string;
  data: Record<string, any>;
}

export interface ITrustScoreJob {
  userId: string;
  action: 'recalculate' | 'invalidate';
}

export interface IBegExpiryJob {
  begId: string;
}