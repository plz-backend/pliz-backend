// src/services/trust-engine.ts
// Trust Engine - Fraud prevention and abuse detection

import prisma from '../config/database';
import { logSuspiciousActivity } from '../logger/pliz-events';
import logger from '../config/logger';

interface DonationCheckParams {
  userId?: string;
  amount: number;
  requestId: string;
  ip?: string;
}

interface TrustCheckResult {
  allowed: boolean;
  reason?: string;
  requiresVerification?: boolean;
}

export class TrustEngine {
  
  /**
   * Check if a donation is allowed
   * Blocks: Self-donations, heavily flagged users
   * Logs: Flagged users, high velocity, large amounts
   */
  async canDonate(params: DonationCheckParams): Promise<TrustCheckResult> {
    try {
      // ============================================
      // 1. Check if user is flagged
      // ============================================
      if (params.userId) {
        const stats = await prisma.userStats.findUnique({
          where: { userId: params.userId },
        });
        
        if (stats && stats.abuseFlags > 0) {
          logSuspiciousActivity({
            userId: params.userId,
            activityType: 'donation_attempt_with_flags',
            details: {
              abuseFlags: stats.abuseFlags,
              requestId: params.requestId,
              amount: params.amount,
            },
          });
          
          // Block if flags >= 5
          if (stats.abuseFlags >= 5) {
            return {
              allowed: false,
              reason: 'Your account has been flagged. Please contact support.',
            };
          }
        }
      }
      
      // ============================================
      // 2. Check donation velocity (same IP)
      // ============================================
      if (params.ip && params.ip !== 'unknown') {
        const recentDonations = await this.getRecentDonationsByIp(params.ip);
        
        if (recentDonations.length > 10) {
          logSuspiciousActivity({
            userId: params.userId || 'anonymous',
            activityType: 'high_velocity_donations',
            details: {
              ip: params.ip,
              recentCount: recentDonations.length,
              amount: params.amount,
              donationIds: recentDonations.map(d => d.id),
            },
          });
          
          // Block if > 15 donations in 1 hour from same IP
          if (recentDonations.length > 15) {
            return {
              allowed: false,
              reason: 'Too many donations from this location. Please try again later.',
            };
          }
        }
      }
      
      // ============================================
      // 3. Check self-donations (BLOCK)
      // ============================================
      if (params.userId) {
        const beg = await prisma.beg.findUnique({
          where: { id: params.requestId },
          select: { userId: true },
        });
        
        if (beg && beg.userId === params.userId) {
          logSuspiciousActivity({
            userId: params.userId,
            activityType: 'self_donation_attempt',
            details: {
              requestId: params.requestId,
              amount: params.amount,
            },
          });
          
          return {
            allowed: false,
            reason: 'You cannot donate to your own request',
          };
        }
      }
      
      // ============================================
      // 4. Check unusually large donations
      // ============================================
      if (params.amount > 50000) {
        logSuspiciousActivity({
          userId: params.userId || 'anonymous',
          activityType: 'large_donation_attempt',
          details: {
            amount: params.amount,
            requestId: params.requestId,
            ip: params.ip,
          },
        });
        
        // Allow but log for future verification
        // Future: Require phone verification for amounts > ₦50k
      }
      
      return { allowed: true };
      
    } catch (error: any) {
      logger.error('Trust engine error', { 
        error: error.message,
        stack: error.stack,
        params 
      });
      
      // On error, fail-open (allow) but log
      return { allowed: true };
    }
  }
  
  /**
   * Get recent donations from IP (last 1 hour)
   * ✅ Now fully functional with IP tracking
   */
  private async getRecentDonationsByIp(ip: string): Promise<any[]> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const donations = await prisma.donation.findMany({
        where: {
          ipAddress: ip,
          createdAt: {
            gte: oneHourAgo,
          },
        },
        select: {
          id: true,
          amount: true,
          createdAt: true,
          donorId: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      
      logger.info('IP velocity check', {
        ip,
        recentDonationCount: donations.length,
      });
      
      return donations;
    } catch (error: any) {
      logger.error('Failed to check IP velocity', {
        error: error.message,
        ip,
      });
      return [];
    }
  }
  
  /**
   * Check total amount donated from IP in last hour
   */
  private async getTotalDonatedFromIp(ip: string): Promise<number> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const result = await prisma.donation.aggregate({
        where: {
          ipAddress: ip,
          createdAt: {
            gte: oneHourAgo,
          },
          status: 'success',
        },
        _sum: {
          amount: true,
        },
      });
      
      return result._sum.amount ? Number(result._sum.amount) : 0;
    } catch (error: any) {
      logger.error('Failed to get total donated from IP', {
        error: error.message,
        ip,
      });
      return 0;
    }
  }
  
  /**
   * Future expansion methods:
   */
  
  /**
   * Check if user can create a beg
   */
  async canCreateBeg(userId: string, amount: number): Promise<TrustCheckResult> {
    // Future: Check cooldown, abuse flags, tier limits
    return { allowed: true };
  }
  
  /**
   * Check if user can request payout
   */
  async canRequestPayout(userId: string, begId: string): Promise<TrustCheckResult> {
    // Future: Verify identity, check fulfillment, anti-fraud
    return { allowed: true };
  }
  
  /**
   * Check if user can report another user
   */
  async canReportUser(reporterId: string, targetId: string): Promise<TrustCheckResult> {
    // Future: Prevent spam reporting
    return { allowed: true };
  }
}

export const trustEngine = new TrustEngine();