import { User, UserRole, UserProfile } from '@prisma/client';

/**
 * =====================================================
 * AUTHENTICATION TYPES
 * =====================================================
 */

export { UserRole } from '@prisma/client';

export type IUser = User;

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
  peopleHelped: number;
  peopleHelpedThisWeek: number;
}

/**
 * User Response Interface (excludes sensitive data)
 * NOTE: state lives inside profile.state — not duplicated here
 * Profile is completed AFTER login so state is not available at login time
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
  updatedAt: Date;
}

export interface ISessionResponse extends ISession {
  deviceInfo: IDeviceInfo;
  formattedIpAddress: string;
  location?: {
    country?: string;
    city?: string;
  };
  isCurrent?: boolean;
}

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
 * Ordered to match the UX flow:
 * Step 1: Personal Identity
 * Step 2: Contact
 * Step 3: Location
 * Step 4: Privacy
 * Step 5: Legal
 */
export interface ICompleteProfileRequest {
  // Step 1: Personal Identity
  firstName: string;
  middleName?: string;
  lastName: string;
  displayName?: string;
  dateOfBirth: Date;                  // ← required, must be 18+
  gender: 'male' | 'female';         // ← required, male or female only

  // Step 2: Contact
  phoneNumber: string;

  // Step 3: Location
  state: string;                      // ← required, must be valid Nigerian state
  city: string;                       // ← required
  address?: string;                   // ← optional

  // Step 4: Privacy
  isAnonymous?: boolean;

  // Step 5: Legal
  agreeToTerms: boolean;              // ← required, must be true
}

/**
 * Update Profile Request
 * Everything optional — user can update individual fields
 */
export interface IUpdateProfileRequest {
  // Personal Identity
  firstName?: string;
  middleName?: string;
  lastName?: string;
  displayName?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female';        // ← male or female only

  // Contact
  phoneNumber?: string;

  // Location
  state?: string;
  city?: string;
  address?: string;

  // Privacy
  isAnonymous?: boolean;
}

/**
 * =====================================================
 * OAUTH TYPES
 * =====================================================
 */

export interface IOAuthRequest {
  provider: 'google' | 'apple';
  idToken: string;
  firstName?: string;                 // Apple only sends this on first login
  lastName?: string;
}

export interface IOAuthProfile {
  provider: 'google' | 'apple';
  providerId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatar?: string;
}