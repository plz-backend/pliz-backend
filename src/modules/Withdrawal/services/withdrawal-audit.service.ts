import { OperationalEventService } from '../../../services/operational-event.service';

export type WithdrawalAuditSource =
  | 'user_request'
  | 'admin_process'
  | 'flutterwave_sync'
  | 'flutterwave_webhook'
  | 'admin_reject'
  | 'system';

export type WithdrawalAuditContext = {
  withdrawalId: string;
  userId?: string | null;
  begId?: string | null;
  transferReference?: string | null;
  amountToReceive?: number;
  status?: string;
};

function metadata(
  ctx: WithdrawalAuditContext,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  return {
    withdrawalId: ctx.withdrawalId,
    ...(ctx.begId ? { begId: ctx.begId } : {}),
    ...(ctx.transferReference ? { transferReference: ctx.transferReference } : {}),
    ...(ctx.amountToReceive != null ? { amountToReceive: ctx.amountToReceive } : {}),
    ...(ctx.status ? { status: ctx.status } : {}),
    ...extra,
  };
}

/**
 * Persist withdrawal lifecycle events for admin/support (exact provider errors, references).
 */
export class WithdrawalAuditService {
  static recordCreated(ctx: WithdrawalAuditContext): void {
    OperationalEventService.record({
      userId: ctx.userId,
      eventType: 'withdrawal.created',
      severity: 'info',
      message: `Withdrawal requested (${ctx.withdrawalId})`,
      source: 'withdrawal',
      metadata: metadata(ctx),
    });
  }

  static recordTransferInitiated(
    ctx: WithdrawalAuditContext,
    transferStatus: string
  ): void {
    OperationalEventService.record({
      userId: ctx.userId,
      eventType: 'withdrawal.transfer_initiated',
      severity: 'info',
      message: `Transfer initiated for withdrawal ${ctx.withdrawalId} (${transferStatus})`,
      source: 'withdrawal',
      metadata: metadata(ctx, { transferStatus }),
    });
  }

  static recordCompleted(ctx: WithdrawalAuditContext): void {
    OperationalEventService.record({
      userId: ctx.userId,
      eventType: 'withdrawal.completed',
      severity: 'info',
      message: `Withdrawal completed (${ctx.withdrawalId})`,
      source: 'withdrawal',
      metadata: metadata(ctx, { status: 'completed' }),
    });
  }

  static recordFailed(
    ctx: WithdrawalAuditContext,
    input: {
      internalReason: string;
      source: WithdrawalAuditSource;
      flutterwavePayload?: unknown;
      adminId?: string;
    }
  ): void {
    OperationalEventService.record({
      userId: ctx.userId,
      eventType: 'withdrawal.failed',
      severity: 'error',
      message: `Withdrawal failed (${ctx.withdrawalId}): ${input.internalReason}`,
      source: 'withdrawal',
      metadata: metadata(ctx, {
        internalFailureReason: input.internalReason,
        failureSource: input.source,
        ...(input.adminId ? { adminId: input.adminId } : {}),
        ...(input.flutterwavePayload != null
          ? { flutterwavePayload: input.flutterwavePayload }
          : {}),
      }),
    });
  }

  static recordOnHold(ctx: WithdrawalAuditContext, reason: string): void {
    OperationalEventService.record({
      userId: ctx.userId,
      eventType: 'withdrawal.on_hold',
      severity: 'warn',
      message: `Withdrawal on hold (${ctx.withdrawalId}): ${reason}`,
      source: 'withdrawal',
      metadata: metadata(ctx, { internalFailureReason: reason, status: 'on_hold' }),
    });
  }

  static recordBegReopened(
    ctx: WithdrawalAuditContext,
    begStatus: string
  ): void {
    OperationalEventService.record({
      userId: ctx.userId,
      eventType: 'withdrawal.beg_reopened',
      severity: 'warn',
      message: `Beg reopened after failed withdrawal (${ctx.begId ?? ctx.withdrawalId}) → ${begStatus}`,
      source: 'withdrawal',
      metadata: metadata(ctx, { begStatus }),
    });
  }

  static recordAdminRejected(
    ctx: WithdrawalAuditContext,
    reason: string,
    adminId: string
  ): void {
    const internalReason = `Rejected by admin: ${reason}`;
    OperationalEventService.record({
      userId: ctx.userId,
      eventType: 'withdrawal.admin_rejected',
      severity: 'warn',
      message: `Withdrawal rejected by admin (${ctx.withdrawalId}): ${reason}`,
      source: 'withdrawal',
      metadata: metadata(ctx, {
        internalFailureReason: internalReason,
        failureSource: 'admin_reject',
        adminId,
      }),
    });
  }
}
