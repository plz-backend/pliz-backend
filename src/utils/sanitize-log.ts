/** Mask phone numbers for logs — keep last 3 digits only. */
export function maskPhoneForLog(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 3) return '***';
  return `***${digits.slice(-3)}`;
}

/** Mask NIN for logs. */
export function maskNinForLog(nin: string | null | undefined): string | null {
  if (!nin) return null;
  const digits = nin.replace(/\D/g, '');
  if (digits.length <= 4) return '****';
  return `${digits.slice(0, 4)}*******`;
}

/** Mask passport number for logs. */
export function maskPassportForLog(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length <= 3) return '***';
  return `${trimmed.slice(0, 3)}*****`;
}

/** Never log raw tokens — return a short prefix only. */
export function maskTokenForLog(token: string | null | undefined): string | null {
  if (!token) return null;
  if (token.length <= 8) return '[redacted]';
  return `${token.slice(0, 4)}…[redacted]`;
}
