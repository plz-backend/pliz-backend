/**
 * Beg Types & Interfaces
 */

export type BegStatus = 'active' | 'funded' | 'expired' | 'cancelled' | 'flagged' | 'rejected';
export type TrustTier = 1 | 2 | 3;
export type ExpiryHours = 24 | 72 | 168;

export enum TrustTierName {
  NEWCOMER = 'Newcomer',
  VERIFIED_BEGINNER = 'Verified Beginner',
  TRUSTED_USER = 'Trusted User',
  SUPER_ASKER = 'Super Asker',
}

export interface ICategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface IBeg {
  id: string;
  userId: string;
  categoryId: string;
  description: string | null;
  expiryHours: ExpiryHours;          // ← ADDED
  amountRequested: number;
  amountRaised: number;
  status: BegStatus;
  approved: boolean;
  approvedAt: Date | null;
  approvedBy: string | null;
  rejectedAt: Date | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  expiresAt: Date;
  payoutRequested: boolean;
  isWithdrawn: boolean;
  withdrawnAt: Date | null;
  mediaType: string | null;
  mediaUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateBegRequest {
  categoryId: string;
  description?: string | null;       // Optional, max 40 words / 300 characters
  amountRequested: number;           // Required, min ₦100
  expiryHours?: ExpiryHours;         // ← ADDED, defaults to 24
  mediaType?: 'video' | 'audio' | 'text';
  mediaUrl?: string;
}

export interface IUpdateBegRequest {
  description?: string | null;       // Max 40 words / 300 characters
  amountRequested?: number;
  mediaType?: 'video' | 'audio' | 'text';
  mediaUrl?: string;
}

export interface IBegResponse {
  id: string;
  userId: string;
  username?: string;
  displayName?: string;
  isAnonymous?: boolean;
  firstName?: string;
  lastName?: string;
  description: string | null;
  expiryHours: ExpiryHours;          // ← ADDED
  category: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
  };
  amountRequested: number;
  amountRaised: number;
  percentFunded?: number;
  status: BegStatus;
  approved: boolean;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  expiresAt: Date;
  createdAt: Date;
  timeRemaining?: string;
  availableExtensions?: {            // ← ADDED: for the extension popup
    hours: ExpiryHours;
    label: string;
  }[];
}

export interface IAdminBegResponse extends IBegResponse {
  approvedBy: string | null;
  rejectedBy: string | null;
  user: {
    id: string;
    email: string;
    username: string;
    isSuspended: boolean;
    isUnderInvestigation: boolean;
    abuseFlags: number;
    requestsCount: number;
  };
}

export interface ITrustTierConfig {
  tier: TrustTier;
  name: TrustTierName;
  maxAmount: number;
  maxAmountUSD: number;
  requestsPerDay: number;
  cooldownHours: number;
  superAskPerMonth: number;
}

export interface ICooldownInfo {
  isOnCooldown: boolean;
  nextRequestAllowedAt: Date | null;
  hoursRemaining?: number;
  message?: string;
}

export interface IUserStats {
  totalDonated: number;
  totalReceived: number;
  requestsCount: number;
  abuseFlags: number;
}

export interface ITrustScore {
  score: number;
  tier: TrustTier;
  tierName: TrustTierName;
  maxAmount: number;
  requestsPerDay: number;
  cooldownHours: number;
}

export interface IBegWithRelations {
  id: string;
  userId: string;
  categoryId: string;
  description: string | null;
  expiryHours: number;               // ← ADDED
  amountRequested: any;
  amountRaised: any;
  status: string;
  approved: boolean;
  approvedAt: Date | null;
  approvedBy: string | null;
  rejectedAt: Date | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  expiresAt: Date;
  payoutRequested: boolean;
  isWithdrawn: boolean;
  withdrawnAt: Date | null;
  mediaType: string | null;
  mediaUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  category: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    description: string | null;
    isActive: boolean;
    sortOrder: number;
  };
  user: {
    username: string;
    profile: {
      displayName: string | null;
      isAnonymous: boolean;
      firstName: string | null;      // ← ADDED (used in transformBegResponse)
      lastName: string | null;       // ← ADDED
    } | null;
  };
}

export interface ITrustProgress {
  currentScore: number;
  currentTier: number;
  currentTierName: string;
  nextTier: number | null;
  nextTierName: string | null;
  pointsToNextTier: number | null;
  progressPercentage: number;
  capabilities: {
    maxAmount: number;
    requestsPerDay: number;
    cooldownHours: number;
  };
  nextCapabilities: {
    maxAmount: number;
    requestsPerDay: number;
    cooldownHours: number;
  } | null;
  breakdown: {
    successfulBegs: number;
    giveBackBonus: number;
    emailVerified: number;
    phoneVerified: number;
    documentVerified: number;
    addressVerified: number;
    penalties: number;
  };
  recommendations: string[];
}

export interface IWithdrawal {
  id: string;
  userId: string;
  begId: string;
  bankAccountId: string;
  amountRequested: number;
  companyFee: number;
  vatFee: number;
  totalFees: number;
  amountToReceive: number;
  transferReference: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'on_hold';
  failureReason: string | null;
  autoProcessed: boolean;
  processedAt: Date | null;
  createdAt: Date;
}

export interface IBankAccount {
  id: string;
  userId: string;
  accountNumber: string;
  accountName: string;
  bankCode: string;
  bankName: string;
  isVerified: boolean;
  isDefault: boolean;
  createdAt: Date;
}

export interface INigerianBank {
  name: string;
  code: string;
  slug: string;
}

export interface IWithdrawalRequest {
  begId: string;
  bankAccountId?: string;
}

export interface IWithdrawalResponse {
  id: string;
  amount_raised: number;
  company_fee: number;
  vat_fee: number;
  total_fees: number;
  amount_to_receive: number;
  bank_account: {
    account_number: string;
    account_name: string;
    bank_name: string;
  };
  status: string;
  auto_processed: boolean;
  created_at: Date;
  processed_at: Date | null;
}