export type VerificationType = 'bvn' | 'nin' | 'passport';
export type VerificationStatus = 'pending' | 'under_review' | 'verified' | 'rejected';
export type NINDocumentType = 'slip' | 'id_card';

// ============================================
// REQUEST INTERFACES
// ============================================

export interface ISubmitKYCRequest {
  verificationType: VerificationType;

  // BVN — number only, no upload
  bvn?: string;

  // NIN — number + document type + uploads
  nin?: string;
  ninDocumentType?: NINDocumentType;  // slip = front only | id_card = front + back
  ninFrontUrl?: string;               // always required for NIN
  ninBackUrl?: string;                // only required for id_card

  // Passport — number + expiry + biodata page
  passportNumber?: string;
  passportExpiry?: string;
  passportBiodataUrl?: string;
}

export interface IVerifyPhoneOTPRequest {
  otp: string;
}

// ============================================
// RESPONSE INTERFACES
// ============================================

export interface IKYCResponse {
  userId: string;
  verificationType: VerificationType | null;
  status: VerificationStatus;
  isVerified: boolean;
  phoneVerified: boolean;
  verifiedAt: Date | null;
  rejectionReason: string | null;
  attemptCount: number;
  attemptsRemaining: number;
  canRetry: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IKYCStatusResponse {
  verification: IKYCResponse | null;
  phoneNumber: string | null;
  steps: IKYCStep[];
  attemptsRemaining: number;
  canRetry: boolean;
  ui: IKYCUIMessage;
}

export interface IKYCStep {
  step: number;
  label: string;
  completed: boolean;
  description: string;
}

export interface IKYCUIMessage {
  title: string;
  body: string;
  buttonLabel: string;
  buttonUrl: string;
}

export interface IProviderVerificationResult {
  success: boolean;
  verified: boolean;
  reference: string;
  data?: Record<string, any>;
  error?: string;
}

export interface IDocumentVerificationResult {
  valid: boolean;
  extractedNumber?: string;
  extractedName?: string;
  error?: string;
}