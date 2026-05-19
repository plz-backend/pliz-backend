export type VerificationType = 'nin' | 'passport';
export type NINDocumentType = 'slip' | 'card';
export type KYCStatus =
  | 'pending'
  | 'document_uploaded'
  | 'liveness_passed'
  | 'under_review'
  | 'verified'
  | 'rejected';

export interface IUploadDocumentRequest {
  verificationType: VerificationType;
  documentType: 'nin_front' | 'nin_back' | 'passport_biodata';

  // NIN fields
  nin?: string;
  ninDocumentType?: NINDocumentType;
  ninMiddleName?: string;
  ninStateOfOrigin?: string;
  ninLGA?: string;

  // Passport fields — middle name first then number
  passportMiddleName?: string;
  passportNumber?: string;
  passportPlaceOfBirth?: string;
  passportIssueDate?: string;    // YYYY-MM-DD
  passportExpiry?: string;       // YYYY-MM-DD
  passportPlaceOfIssue?: string;
}

export interface IVerifyPhoneOTPRequest {
  otp: string;
}

// ============================================
// RESPONSE INTERFACES
// ============================================

export interface IKYCResponse {
  id: string;
  userId: string;
  verificationType: string | null;
  status: KYCStatus;
  isVerified: boolean;
  phoneVerified: boolean;
  documentVerified: boolean;
  faceLivenessPassed: boolean;
  faceLivenessScore: number | null;
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

export interface IPremblyVerificationResult {
  verified: boolean;
  reference: string;
  data?: any;
  error?: string;
}