import { User, UserRole, UserProfile } from '@prisma/client';  // Import UserProfile

/**
 * =====================================================
 * AUTHENTICATION TYPES
 * =====================================================
 */

/**
 * Re-export UserRole from Prisma
 */
export { UserRole } from '@prisma/client';

/**
 * Re-export User type from Prisma
 */
export type IUser = User;

/**
 * Re-export UserProfile type from Prisma
 *  ADDED: Use Prisma's generated type
 */
export type IUserProfile = UserProfile;

/**
 * JWT Payload Interface
 */
export interface IJWTPayload {
  userId: string;
  sessionId: string;
  email: string;
  role: UserRole;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}


/** Aggregated public stats from `user_stats` + computed fields (GET /me, etc.) */
export interface IUserStatsSummary {
  totalDonated: number;
  totalReceived: number;
  requestsCount: number;
  /** Distinct request owners this user has successfully donated to */
  peopleHelped: number;
  /** Distinct request owners donated to in the last 7 days (rolling window) */
  peopleHelpedThisWeek: number;
}

/**
 * User Response Interface (excludes sensitive data)
 */
export interface IUserResponse {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  isEmailVerified: boolean;
  emailVerifiedAt: Date | null;
  isProfileComplete: boolean;
  isSuspended: boolean;
  isUnderInvestigation: boolean;
  createdAt: Date;
  updatedAt: Date;
  profile?: IUserProfile | null;
  /** Present on GET /api/auth/me when `stats` relation is loaded */
  stats?: IUserStatsSummary | null;
}

/**
 * Registration Request (Public - creates 'user' role only)
 */
export interface IRegisterRequest {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

/**
 * Create Admin User Request (Admin/Superadmin only)
 */
export interface ICreateAdminRequest {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: UserRole;  
}

/**
 * Login Request
 */
export interface ILoginRequest {
  email: string;
  password: string;
}


/**
 * Login Response
 */
export interface ILoginResponse {
  user: IUserResponse;
  accessToken: string;
  refreshToken: string;
}

/**
 * Forgot Password Request
 */
export interface IForgotPasswordRequest {
  email: string;
}

/**
 * Password Reset Request
 */
export interface IPasswordResetRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Change Password Request
 */
export interface IChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Refresh Token Request
 */
export interface IRefreshTokenRequest {
  refreshToken: string;
}

/**
 * API Response Interface
 */
export interface IApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

/**
 * =====================================================
 * SESSION MANAGEMENT TYPES
 * =====================================================
 */

/**
 * Session Interface (matches Prisma schema)
 */
export interface ISession {
  id: string;
  userId: string;
  refreshToken: string | null;
  active: boolean;
  lastActive: Date;
  expiresAt: Date;
  userAgent: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  ipAddress: string | null;
  country: string | null;
  city: string | null;
  createdAt: Date;
  updatedAt: Date;  // Prisma's @updatedAt will handle this automatically
}

/**
 * Session Response (for API) - Extends ISession with formatted fields
 */
export interface ISessionResponse extends ISession {
  deviceInfo: IDeviceInfo;          // Formatted device info
  formattedIpAddress: string;       // Non-null IP address
  location?: {                       // Formatted location
    country?: string;
    city?: string;
  };
  isCurrent?: boolean;              // Is this the current session?
}

/**
 * Device Info
 */
export interface IDeviceInfo {
  userAgent: string;
  browser: string;
  os: string;
  device: string;
}

/**
 * =====================================================
 * PROFILE TYPES
 * =====================================================
 */

/**
 * Complete Profile Request
 */
export interface ICompleteProfileRequest {
  firstName: string;
  middleName?: string;
  lastName: string;
  phoneNumber: string;
  dateOfBirth?: Date;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  displayName?: string;
  isAnonymous?: boolean;
  agreeToTerms: boolean;
}

/**
 * Update Profile Request
 */
export interface IUpdateProfileRequest {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  phoneNumber?: string;
  dateOfBirth?: Date;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  displayName?: string;
  isAnonymous?: boolean;
}