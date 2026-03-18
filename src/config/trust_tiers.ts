import { ITrustTierConfig, TrustTierName } from '../modules/Beg/types/beg.interface';

/**
 * Trust Tier Configurations
 * Based on Pliz business rules
 */
export const TRUST_TIERS: ITrustTierConfig[] = [
  {
    tier: 1,
    name: TrustTierName.NEWCOMER,
    maxAmount: 10000,          // ₦10,000
    maxAmountUSD: 10,          // $10
    requestsPerDay: 1,
    cooldownHours: 48,
    superAskPerMonth: 0,
  },
  {
    tier: 2,
    name: TrustTierName.VERIFIED_BEGINNER,
    maxAmount: 50000,          // ₦50,000
    maxAmountUSD: 50,          // $50
    requestsPerDay: 2,
    cooldownHours: 48,
    superAskPerMonth: 0,
  },
  {
    tier: 3,
    name: TrustTierName.TRUSTED_USER,
    maxAmount: 150000,         // ₦150,000
    maxAmountUSD: 150,         // $150
    requestsPerDay: 2,
    cooldownHours: 24,
    superAskPerMonth: 1,
  },
];

/**
 * Get trust tier config by tier number
 */
export const getTrustTierConfig = (tier: number): ITrustTierConfig => {
  return TRUST_TIERS.find(t => t.tier === tier) || TRUST_TIERS[0];
};

/**
 * Super Ask Config (Tier 4 - once per month)
 */
export const SUPER_ASK_CONFIG = {
  maxAmount: 250000,          // ₦250,000
  maxAmountUSD: 250,          // $250
  requestsPerMonth: 1,
  minimumTrustScore: 75,
  requiresManualReview: true,
};

/**
 * Beg expiry duration (in days)
 */
export const BEG_EXPIRY_DAYS = 7;

/**
 * Max title length (in words)
 */
export const MAX_TITLE_WORDS = 25;

/**
 * Max title length (in characters)
 */
export const MAX_TITLE_CHARS = 240;