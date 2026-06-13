import { TransactionPinError } from '../../Security/services/transaction-pin.service';

/** Generic copy shown to users when a payout/transfer fails (never expose FLW ops details). */
export const WITHDRAWAL_TRANSFER_FAILURE_USER_MESSAGE =
  'Your withdrawal could not be completed. Please try again later or contact support.';

/** Shown on failed rows in withdrawal history. */
export const WITHDRAWAL_HISTORY_FAILURE_USER_MESSAGE =
  'Withdrawal failed. Please try again or contact support if this continues.';

/** Intentional validation / business-rule messages safe to return from POST /withdrawals/request. */
const ALLOWED_WITHDRAWAL_REQUEST_MESSAGES = [
  'Enter your Transaction PIN to continue.',
  'Beg not found',
  'You can only withdraw from your own requests',
  'No donations to withdraw yet. Wait until you receive at least one donation.',
  'You have already withdrawn funds from this request.',
  'This request is not eligible for withdrawal.',
  'Withdrawal already requested for this beg',
  'No bank account found. Please add a bank account first.',
  'Bank account must be verified',
  'Withdrawal not found',
  'User account is suspended or under investigation',
  'Too many withdrawal attempts. Please try again later.',
  'Too many bank verification attempts. Please try again later.',
] as const;

function isAllowedWithdrawalRequestMessage(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return false;
  if (
    ALLOWED_WITHDRAWAL_REQUEST_MESSAGES.some(
      (allowed) => allowed === trimmed || trimmed.startsWith(allowed)
    )
  ) {
    return true;
  }
  if (trimmed.startsWith('Your account is suspended')) return true;
  if (trimmed.startsWith('Your account is under investigation')) return true;
  if (trimmed.startsWith('Incorrect Transaction PIN')) return true;
  if (trimmed.startsWith('Your Transaction PIN is temporarily locked')) return true;
  if (trimmed.startsWith('Set up your Transaction PIN')) return true;
  if (trimmed.startsWith('Too many incorrect PIN attempts')) return true;
  if (trimmed.startsWith('Withdrawal is already')) return true;
  if (trimmed.startsWith('Withdrawal not found')) return true;
  return false;
}

/** Map thrown errors to a safe API message for withdrawal request. */
export function toUserWithdrawalRequestMessage(error: unknown): string {
  if (error instanceof TransactionPinError) {
    return error.message;
  }
  if (error instanceof Error && isAllowedWithdrawalRequestMessage(error.message)) {
    return error.message.trim();
  }
  return WITHDRAWAL_TRANSFER_FAILURE_USER_MESSAGE;
}

/** User-safe failure text for history list / emails (internal reason stays in DB for admins). */
export function toUserWithdrawalFailureDisplay(
  internalReason: string | null | undefined
): string | null {
  if (!internalReason?.trim()) return null;
  if (internalReason.startsWith('Rejected by admin:')) {
    return 'Your withdrawal was reviewed and could not be processed. Please contact support for help.';
  }
  return WITHDRAWAL_HISTORY_FAILURE_USER_MESSAGE;
}

/** Extract provider/internal detail for logs and admin (not for end users). */
export function extractInternalTransferFailureReason(source: unknown): string {
  if (source && typeof source === 'object' && 'response' in source) {
    const response = (source as { response?: { data?: unknown } }).response;
    const data = response?.data;
    if (data && typeof data === 'object') {
      const message = (data as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim()) {
        return message.trim();
      }
      try {
        return JSON.stringify(data);
      } catch {
        /* fall through */
      }
    }
  }
  if (source instanceof Error && source.message.trim()) {
    return source.message.trim();
  }
  if (typeof source === 'string' && source.trim()) {
    return source.trim();
  }
  return 'Transfer failed';
}
