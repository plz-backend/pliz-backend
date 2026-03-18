// src/logger/pliz-events.ts
// Pliz-specific business event logging

import logger from './logger-index';

// ============================================
// MODULE LOGGERS
// ============================================
export const authLogger = logger.forModule('auth');
export const begLogger = logger.forModule('Beg');
export const donorLogger = logger.forModule('Donor');
export const adminLogger = logger.forModule('Admin');
export const trustLogger = logger.forModule('Trust');
export const paymentLogger = logger.forModule('Payment');

// ============================================
// BEG LIFECYCLE EVENTS
// ============================================

export function logBegCreated(begData: {
  begId: string;
  userId: string;
  category: string;
  amountRequested: number;
  expiresAt: Date;
}) {
  begLogger.info('Beg request created', {
    event: 'beg_created',
    begId: begData.begId,
    userId: begData.userId,
    category: begData.category,
    amountRequested: begData.amountRequested,
    expiresHours: Math.round((begData.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)),
  });
}

export function logBegApproved(begData: {
  begId: string;
  approvedBy: string;
  userTier: number;
}) {
  begLogger.info('Beg request approved', {
    event: 'beg_approved',
    begId: begData.begId,
    approvedBy: begData.approvedBy,
    userTier: begData.userTier,
  });
}

export function logBegRejected(begData: {
  begId: string;
  rejectedBy: string;
  reason: string;
}) {
  begLogger.warn('Beg request rejected', {
    event: 'beg_rejected',
    begId: begData.begId,
    rejectedBy: begData.rejectedBy,
    reason: begData.reason,
  });
}

export function logBegFunded(begData: {
  begId: string;
  userId: string;
  amountRequested: number;
  amountRaised: number;
  donorCount: number;
  timeToFund: number; // milliseconds
}) {
  begLogger.info('Beg request fully funded', {
    event: 'beg_funded',
    begId: begData.begId,
    userId: begData.userId,
    amountRequested: begData.amountRequested,
    amountRaised: begData.amountRaised,
    donorCount: begData.donorCount,
    timeToFundHours: Math.round(begData.timeToFund / (1000 * 60 * 60)),
  });
}

export function logBegExpired(begData: {
  begId: string;
  userId: string;
  amountRequested: number;
  amountRaised: number;
  percentageFunded: number;
}) {
  begLogger.info('Beg request expired', {
    event: 'beg_expired',
    begId: begData.begId,
    userId: begData.userId,
    amountRequested: begData.amountRequested,
    amountRaised: begData.amountRaised,
    percentageFunded: begData.percentageFunded,
  });
}

export function logPayoutRequested(begData: {
  begId: string;
  userId: string;
  amountToPayout: number;
  percentageFunded: number;
}) {
  begLogger.info('Payout requested', {
    event: 'payout_requested',
    begId: begData.begId,
    userId: begData.userId,
    amountToPayout: begData.amountToPayout,
    percentageFunded: begData.percentageFunded,
  });
}

// ============================================
// DONATION EVENTS
// ============================================

export function logDonationAttempt(donationData: {
  donorId?: string;
  begId: string;
  amount: number;
  isAnonymous: boolean;
  paymentMethod: string;
}) {
  donorLogger.info('Donation attempt started', {
    event: 'donation_attempt',
    donorId: donationData.donorId || 'anonymous',
    begId: donationData.begId,
    amount: donationData.amount,
    isAnonymous: donationData.isAnonymous,
    paymentMethod: donationData.paymentMethod,
  });
}

export function logDonationSuccess(donationData: {
  donationId: string;
  donorId?: string;
  begId: string;
  amount: number;
  paymentReference: string;
  isFirstDonation: boolean;
}) {
  donorLogger.info('Donation successful', {
    event: 'donation_success',
    donationId: donationData.donationId,
    donorId: donationData.donorId || 'anonymous',
    begId: donationData.begId,
    amount: donationData.amount,
    paymentReference: donationData.paymentReference,
    isFirstDonation: donationData.isFirstDonation,
  });
}

export function logDonationFailed(donationData: {
  donorId?: string;
  begId: string;
  amount: number;
  reason: string;
  paymentMethod: string;
}) {
  donorLogger.error('Donation failed', {
    event: 'donation_failed',
    donorId: donationData.donorId || 'anonymous',
    begId: donationData.begId,
    amount: donationData.amount,
    reason: donationData.reason,
    paymentMethod: donationData.paymentMethod,
  });
}

export function logDonationReversed(donationData: {
  donationId: string;
  begId: string;
  amount: number;
  reason: string;
}) {
  donorLogger.warn('Donation reversed', {
    event: 'donation_reversed',
    donationId: donationData.donationId,
    begId: donationData.begId,
    amount: donationData.amount,
    reason: donationData.reason,
  });
}

// ============================================
// GRATITUDE & ENGAGEMENT
// ============================================

export function logGratitudeSent(gratitudeData: {
  donationId: string;
  begId: string;
  messageType: number;
}) {
  begLogger.info('Gratitude message sent', {
    event: 'gratitude_sent',
    donationId: gratitudeData.donationId,
    begId: gratitudeData.begId,
    messageType: gratitudeData.messageType,
  });
}

export function logDonorReplied(replyData: {
  donationId: string;
  donorId: string;
}) {
  donorLogger.info('Donor replied to gratitude', {
    event: 'donor_replied',
    donationId: replyData.donationId,
    donorId: replyData.donorId,
  });
}

// ============================================
// TRUST & TIER EVENTS
// ============================================

export function logTierUpgrade(tierData: {
  userId: string;
  oldTier: number;
  newTier: number;
  reason: string;
}) {
  trustLogger.info('User tier upgraded', {
    event: 'tier_upgrade',
    userId: tierData.userId,
    oldTier: tierData.oldTier,
    newTier: tierData.newTier,
    reason: tierData.reason,
  });
}

export function logTierDowngrade(tierData: {
  userId: string;
  oldTier: number;
  newTier: number;
  reason: string;
}) {
  trustLogger.warn('User tier downgraded', {
    event: 'tier_downgrade',
    userId: tierData.userId,
    oldTier: tierData.oldTier,
    newTier: tierData.newTier,
    reason: tierData.reason,
  });
}

export function logCooldownViolation(cooldownData: {
  userId: string;
  nextAllowedAt: Date;
  attemptedAt: Date;
}) {
  trustLogger.warn('Cooldown period violation', {
    event: 'cooldown_violation',
    userId: cooldownData.userId,
    hoursRemaining: Math.round((cooldownData.nextAllowedAt.getTime() - cooldownData.attemptedAt.getTime()) / (1000 * 60 * 60)),
  });
}

export function logRequestLimitExceeded(limitData: {
  userId: string;
  currentTier: number;
  requestedAmount: number;
  maxAllowed: number;
}) {
  trustLogger.warn('Request amount exceeds tier limit', {
    event: 'limit_exceeded',
    userId: limitData.userId,
    currentTier: limitData.currentTier,
    requestedAmount: limitData.requestedAmount,
    maxAllowed: limitData.maxAllowed,
  });
}

// ============================================
// VERIFICATION EVENTS
// ============================================

export function logVerificationStarted(verificationData: {
  userId: string;
  verificationType: 'phone' | 'document' | 'address';
}) {
  authLogger.info('Verification started', {
    event: 'verification_started',
    userId: verificationData.userId,
    verificationType: verificationData.verificationType,
  });
}

export function logVerificationCompleted(verificationData: {
  userId: string;
  verificationType: 'phone' | 'document' | 'address';
  provider?: string;
}) {
  authLogger.info('Verification completed', {
    event: 'verification_completed',
    userId: verificationData.userId,
    verificationType: verificationData.verificationType,
    provider: verificationData.provider,
  });
}

// ============================================
// ABUSE & MODERATION
// ============================================

export function logReportSubmitted(reportData: {
  reportId: string;
  reporterId?: string;
  targetUserId?: string;
  begId?: string;
  reason: string;
}) {
  adminLogger.warn('Report submitted', {
    event: 'report_submitted',
    reportId: reportData.reportId,
    reporterId: reportData.reporterId,
    targetUserId: reportData.targetUserId,
    begId: reportData.begId,
    reason: reportData.reason,
  });
}

export function logUserFlagged(flagData: {
  userId: string;
  reason: string;
  flaggedBy: string;
  abuseCount: number;
}) {
  adminLogger.error('User flagged for abuse', {
    event: 'user_flagged',
    userId: flagData.userId,
    reason: flagData.reason,
    flaggedBy: flagData.flaggedBy,
    abuseCount: flagData.abuseCount,
  });
}

export function logSuspiciousActivity(activityData: {
  userId: string;
  activityType: string;
  details: any;
}) {
  adminLogger.warn('Suspicious activity detected', {
    event: 'suspicious_activity',
    userId: activityData.userId,
    activityType: activityData.activityType,
    details: activityData.details,
  });
}

// ============================================
// ADMIN ACTIONS
// ============================================

// export function logAdminAction(actionData: {
//   adminId: string;
//   actionType: string;
//   targetId?: string;
//   notes?: string;
// }) {
//   adminLogger.info('Admin action executed', {
//     event: 'admin_action',
//     adminId: actionData.adminId,
//     actionType: actionData.actionType,
//     targetId: actionData.targetId,
//     notes: actionData.notes,
//   });
// }

// export function logPayoutPaused(payoutData: {
//   begId: string;
//   pausedBy: string;
//   reason: string;
// }) {
//   adminLogger.warn('Payout paused', {
//     event: 'payout_paused',
//     begId: payoutData.begId,
//     pausedBy: payoutData.pausedBy,
//     reason: payoutData.reason,
//   });
// }

// ============================================
// PAYMENT GATEWAY EVENTS
// ============================================

export function logPaymentGatewayError(errorData: {
  gateway: string;
  errorCode: string;
  errorMessage: string;
  amount: number;
  reference?: string;
}) {
  paymentLogger.error('Payment gateway error', {
    event: 'payment_gateway_error',
    gateway: errorData.gateway,
    errorCode: errorData.errorCode,
    errorMessage: errorData.errorMessage,
    amount: errorData.amount,
    reference: errorData.reference,
  });
}

export function logPaymentWebhook(webhookData: {
  gateway: string;
  event: string;
  reference: string;
  status: string;
}) {
  paymentLogger.info('Payment webhook received', {
    event: 'payment_webhook',
    gateway: webhookData.gateway,
    webhookEvent: webhookData.event,
    reference: webhookData.reference,
    status: webhookData.status,
  });
}

// ============================================
// USER MILESTONES (Private)
// ============================================

export function logDonorMilestone(milestoneData: {
  userId: string;
  milestone: string;
  totalDonated?: number;
  peopleHelped?: number;
}) {
  donorLogger.info('Donor milestone achieved', {
    event: 'donor_milestone',
    userId: milestoneData.userId,
    milestone: milestoneData.milestone,
    totalDonated: milestoneData.totalDonated,
    peopleHelped: milestoneData.peopleHelped,
  });
}


// ============================================
// ADMIN ACTIONS (USED INTERNALLY IN ADMIN SERVICE - NOT EXPOSED TO CONTROLLERS)
// ============================================
export function logAdminAction(actionData: {
  adminId: string;
  actionType: string;
  targetId?: string;
  notes?: string;
}) {
  adminLogger.info('Admin action executed', {
    event: 'admin_action',
    adminId: actionData.adminId,
    actionType: actionData.actionType,
    targetId: actionData.targetId,
    notes: actionData.notes,
  });
}

export function logUserSuspended(data: {
  userId: string;
  adminId: string;
  reason: string;
}) {
  adminLogger.warn('User suspended', {
    event: 'user_suspended',
    userId: data.userId,
    adminId: data.adminId,
    reason: data.reason,
  });
}

export function logUserInvestigated(data: {
  userId: string;
  adminId: string;
  reason: string;
}) {
  adminLogger.warn('User under investigation', {
    event: 'user_investigated',
    userId: data.userId,
    adminId: data.adminId,
    reason: data.reason,
  });
}
