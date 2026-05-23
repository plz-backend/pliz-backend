/**
 * Allow Paystack redirect targets we control (web app + native deep links).
 */
export function isAllowedPaystackCallbackUrl(raw: string): boolean {
  const url = raw.trim();
  if (!url || !url.includes('payment/callback')) return false;

  const frontend = process.env.FRONTEND_URL?.replace(/\/$/, '');
  if (frontend && url.startsWith(`${frontend}/payment/callback`)) {
    return true;
  }

  if (url.startsWith('plz://')) return true;
  if (url.startsWith('exp://')) return true;

  return false;
}
