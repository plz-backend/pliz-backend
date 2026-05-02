import { ITrustTierConfig, TrustTierName } from '../modules/Beg/types/beg.interface';

// ============================================
// TRUST TIERS
//
// Tier 1 — Newcomer
//   Max: ₦10,000
//   To go beyond: KYC verified + 1 donation
//
// Tier 2 — Verified User
//   Max: ₦50,000
//   To go beyond: total donated ≥ ₦10,000
//
// Tier 3 — Trusted User
//   Max: ₦100,000
//   Cooldown: 7 days
//   To go beyond: total donated ≥ ₦50,000
//
// Tier 4 — Super User
//   Max: ₦200,000
//   Cooldown: 14 days
//   MVP cap — no one goes beyond this
// ============================================

export const TRUST_TIERS: ITrustTierConfig[] = [
  {
    tier: 1,
    name: TrustTierName.NEWCOMER,
    badge: '🌱',
    description: 'You can request up to ₦10,000',
    maxAmount: 10000,
    requestsPerDay: 1,
    cooldownHours: 24,
    cooldownDays: 1,
    requiredDonationTotal: 0,
    requiresVerification: false,
  },
  {
    tier: 2,
    name: TrustTierName.VERIFIED_USER,
    badge: '✅',
    description: 'You can request up to ₦50,000',
    maxAmount: 50000,
    requestsPerDay: 2,
    cooldownHours: 48,
    cooldownDays: 2,
    requiredDonationTotal: 0,       // needs verification + any donation
    requiresVerification: true,
  },
  {
    tier: 3,
    name: TrustTierName.TRUSTED_USER,
    badge: '⭐',
    description: 'You can request up to ₦100,000',
    maxAmount: 100000,
    requestsPerDay: 3,
    cooldownHours: 168,             // 7 days
    cooldownDays: 7,
    requiredDonationTotal: 10000,   // total donated ≥ ₦10,000
    requiresVerification: true,
  },
  {
    tier: 4,
    name: TrustTierName.SUPER_USER,
    badge: '👑',
    description: 'You can request up to ₦200,000',
    maxAmount: 200000,
    requestsPerDay: 5,
    cooldownHours: 336,             // 14 days
    cooldownDays: 14,
    requiredDonationTotal: 50000,   // total donated ≥ ₦50,000
    requiresVerification: true,
  },
];

export const getTrustTierConfig = (tier: number): ITrustTierConfig => {
  return TRUST_TIERS.find(t => t.tier === tier) || TRUST_TIERS[0];
};

export const getNextTierConfig = (tier: number): ITrustTierConfig | null => {
  return TRUST_TIERS.find(t => t.tier === tier + 1) || null;
};