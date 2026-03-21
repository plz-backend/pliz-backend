/**
 * Beg Types & Interfaces
 */

// Beg statuses
export type BegStatus = 'active' | 'funded' | 'expired' | 'cancelled' | 'flagged' | 'rejected'; // ✅ Added 'rejected'

// Trust tiers
export type TrustTier = 1 | 2 | 3;

// Trust tier names
export enum TrustTierName {
  NEWCOMER = 'Newcomer',
  VERIFIED_BEGINNER = 'Verified Beginner',
  TRUSTED_USER = 'Trusted User',
  SUPER_ASKER = 'Super Asker',
}

/**
 * Category Interface
 */
export interface ICategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  isActive: boolean;
  sortOrder: number;
}

/**
 * Beg Interface
 */
export interface IBeg {
  id: string;
  userId: string;
  categoryId: string;
  title: string;
  description: string | null;
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

/**
 * Create Beg Request
 */
export interface ICreateBegRequest {
  categoryId: string;                  // Category ID
  title: string;                     // Required, max 25 characters
  description?: string | null;       // Optional, max 30 words / 500 characters
  amountRequested: number;           // Required, min ₦100
  mediaType?: 'video' | 'audio' | 'text';
  mediaUrl?: string;
}

/**
 * Update Beg Request
 */
export interface IUpdateBegRequest {
  title?: string;                    // Max 25 characters
  description?: string | null;       // Max 30 words / 500 characters
  amountRequested?: number;
  mediaType?: 'video' | 'audio' | 'text';
  mediaUrl?: string;
}

/**
 * Beg Response (for API)
 */
export interface IBegResponse {
  id: string;
  userId: string;
  username?: string;
  displayName?: string;
  isAnonymous?: boolean;
  /** Public listing: given name (omitted when anonymous). */
  firstName?: string;
  /** Public listing: family name (omitted when anonymous). */
  lastName?: string;
  title: string;                     
  description: string | null;        
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
}

/**
 * Admin Beg Response (includes admin fields)
 */
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

/**
 * Trust Tier Config
 */
export interface ITrustTierConfig {
  tier: TrustTier;
  name: TrustTierName;
  maxAmount: number;
  maxAmountUSD: number;
  requestsPerDay: number;
  cooldownHours: number;
  superAskPerMonth: number;
}

/**
 * Cooldown Info
 */
export interface ICooldownInfo {
  isOnCooldown: boolean;
  nextRequestAllowedAt: Date | null;
  hoursRemaining?: number;
  message?: string;
}

/**
 * User Stats
 */
export interface IUserStats {
  totalDonated: number;
  totalReceived: number;
  requestsCount: number;
  abuseFlags: number;
}

/**
 * Trust Score
 */
export interface ITrustScore {
  score: number;
  tier: TrustTier;
  tierName: TrustTierName;
  maxAmount: number;
  requestsPerDay: number;
  cooldownHours: number;
}

/**
 * Beg with relations (from Prisma)
 */
export interface IBegWithRelations {
  id: string;
  userId: string;
  categoryId: string;
  title: string;
  description: string | null;
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
    } | null;
  };
}

/**
 * Trust tier progress information
 */
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

/**
 * Withdrawal Interface
 */
export interface IWithdrawal {
  id: string;
  userId: string;
  begId: string;
  bankAccountId: string;
  amountRequested: number;
  companyFee: number;              // 5%
  vatFee: number;                  // 7.5%
  totalFees: number;               // 12.5%
  amountToReceive: number;         // After fees
  transferReference: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'on_hold';
  failureReason: string | null;
  autoProcessed: boolean;
  processedAt: Date | null;
  createdAt: Date;
}

/**
 * Bank Account Interface
 */
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

/**
 * Nigerian Bank Interface
 */
export interface INigerianBank {
  name: string;
  code: string;
  slug: string;
}

/**
 * Withdrawal Request
 */
export interface IWithdrawalRequest {
  begId: string;
  bankAccountId?: string;  // Optional - uses default if not provided
}

/**
 * Withdrawal Response
 */
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