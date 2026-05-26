import axios from 'axios';
import logger from '../../../config/logger';
import { IPremblyVerificationResult } from '../types/kyc.interface';
import { maskPassportForLog } from '../../../utils/sanitize-log';

const PREMBLY_BASE_URL = 'https://api.prembly.com';

const getHeaders = () => ({
  'x-api-key': process.env.PREMBLY_API_KEY!,
  'app-id': process.env.PREMBLY_APP_ID!,
  'Content-Type': 'application/json',
});

const shouldSkipPrembly = () =>
  process.env.PREMBLY_SKIP_VERIFICATION === 'true';

export class IdentityVerificationService {

  // ============================================
  // VERIFY NIN — Prembly vNIN (NIN Advance)
  // https://docs.prembly.com/reference/nin-and-virtual-nin
  // Accepts 11-digit NIN (number_nin) or 16-char Virtual NIN (number).
  // ============================================
  static async verifyNIN(
    nin: string,
    profile: {
      firstName: string;
      lastName: string;
      dateOfBirth: Date | null;
      gender: string | null;
      phoneNumber: string | null;
    }
  ): Promise<IPremblyVerificationResult> {
    const request = this.buildVninRequest(nin);
    if ('error' in request) {
      return {
        verified: false,
        reference: nin.trim(),
        error: request.error,
      };
    }

    const { body, reference, kind } = request;

    try {
      if (shouldSkipPrembly()) {
        logger.info('PREMBLY_SKIP_VERIFICATION — NIN verification skipped');
        return { verified: true, reference };
      }

      logger.info('Calling Prembly vNIN API', {
        kind,
        identifier: kind === 'nin' ? reference.substring(0, 4) + '*******' : reference.substring(0, 4) + '************',
      });

      const response = await axios.post(
        `${PREMBLY_BASE_URL}/verification/vnin`,
        body,
        { headers: getHeaders(), timeout: 30000 }
      );

      const result = response.data;
      const isSuccess =
        result.status === true || result.response_code === '00';

      if (!isSuccess) {
        return {
          verified: false,
          reference,
          error:
            result.detail ||
            result.message ||
            'NIN verification failed. Please check your NIN or vNIN and try again.',
        };
      }

      const ninData = result.nin_data || result.data || {};
      const providerReference =
        result.verification?.reference?.toString() || reference;

      const firstNameMatch = this.nameMatch(
        ninData.firstname || ninData.first_name || '',
        profile.firstName
      );
      const lastNameMatch = this.nameMatch(
        ninData.surname || ninData.last_name || '',
        profile.lastName
      );

      if (!firstNameMatch || !lastNameMatch) {
        return {
          verified: false,
          reference: providerReference,
          data: ninData,
          error:
            'The name on your NIN does not match your profile name. Please update your first name and last name to exactly match your NIN.',
        };
      }

      logger.info('NIN verified successfully via vNIN API', {
        providerReference,
        responseCode: result.response_code,
        kind,
      });
      return {
        verified: true,
        reference: providerReference,
        data: ninData,
      };
    } catch (error: any) {
      logger.error('Prembly vNIN API failed', {
        error: error.message,
        status: error.response?.status,
        detail: error.response?.data?.detail,
      });
      return {
        verified: false,
        reference,
        error:
          error.response?.data?.detail ||
          error.response?.data?.message ||
          'NIN verification failed. Please try again later.',
      };
    }
  }

  private static buildVninRequest(input: string):
    | { body: { number_nin: string }; reference: string; kind: 'nin' }
    | { body: { number: string }; reference: string; kind: 'vnin' }
    | { error: string } {
    const trimmed = input.trim();
    const digitsOnly = trimmed.replace(/\D/g, '');

    if (/^\d{11}$/.test(digitsOnly)) {
      return {
        body: { number_nin: digitsOnly },
        reference: digitsOnly,
        kind: 'nin',
      };
    }

    const vnin = trimmed.replace(/\s/g, '').toUpperCase();
    if (/^[A-Z0-9]{16}$/.test(vnin)) {
      return {
        body: { number: vnin },
        reference: vnin,
        kind: 'vnin',
      };
    }

    return {
      error:
        'Please enter a valid 11-digit NIN or 16-character Virtual NIN (vNIN) from the NIMC app.',
    };
  }

  // VERIFY PASSPORT (basic — no face match)
  // Used when KYC_REQUIRE_FACE_LIVENESS=false
  // ============================================
  static async verifyPassportBasic(
    passportNumber: string,
    passportExpiry: string,
    profile: {
      firstName: string;
      lastName: string;
      dateOfBirth: Date | null;
      gender: string | null;
    }
  ): Promise<IPremblyVerificationResult> {
    const normalizedPassport = passportNumber.trim().toUpperCase();

    try {
      if (new Date(passportExpiry) < new Date()) {
        return {
          verified: false,
          reference: normalizedPassport,
          error: 'Your passport has expired. Please use a valid passport.',
        };
      }

      if (shouldSkipPrembly()) {
        logger.info('PREMBLY_SKIP_VERIFICATION — Passport verification skipped');
        return { verified: true, reference: normalizedPassport };
      }

      logger.info('Calling Prembly Passport API', {
        passport: maskPassportForLog(normalizedPassport),
      });

      const response = await axios.post(
        `${PREMBLY_BASE_URL}/verification/national_passport`,
        {
          number: normalizedPassport,
          last_name: profile.lastName.trim(),
        },
        { headers: getHeaders(), timeout: 60000 }
      );

      const result = response.data;
      const isSuccess =
        result.status === true || result.response_code === '00';

      if (!isSuccess) {
        return {
          verified: false,
          reference: normalizedPassport,
          error:
            result.detail ||
            result.message ||
            'Passport verification failed. Please check your passport details.',
        };
      }

      const passportData = result.passport_data || result.data || {};
      const providerReference =
        result.verification?.reference?.toString() || normalizedPassport;

      const firstNameMatch = this.nameMatch(
        passportData.first_name || passportData.firstname || '',
        profile.firstName
      );
      const lastNameMatch = this.nameMatch(
        passportData.last_name || passportData.surname || '',
        profile.lastName
      );

      if (!firstNameMatch || !lastNameMatch) {
        return {
          verified: false,
          reference: providerReference,
          data: passportData,
          error:
            'The name on your passport does not match your profile name. Please update your first name and last name to exactly match your passport.',
        };
      }

      return {
        verified: true,
        reference: providerReference,
        data: passportData,
      };
    } catch (error: any) {
      logger.error('Passport API failed', {
        error: error.message,
        status: error.response?.status,
      });
      return {
        verified: false,
        reference: normalizedPassport,
        error:
          error.response?.data?.detail ||
          error.response?.data?.message ||
          'Passport verification failed. Please try again later.',
      };
    }
  }

  // ============================================
  // VERIFY PASSPORT — Prembly v2 (+ Face Validation)
  // https://docs.prembly.com/reference/international-passport-face-validation
  // ============================================
  static async verifyPassport(
    passportNumber: string,
    passportExpiry: string,
    profile: {
      firstName: string;
      lastName: string;
      dateOfBirth: Date | null;
      gender: string | null;
    },
    _passportFormData: {
      passportMiddleName?: string | null;
      passportPlaceOfBirth: string;
      passportIssueDate: string;
      passportPlaceOfIssue: string;
    },
    faceImage: string
  ): Promise<IPremblyVerificationResult> {
    const normalizedPassport = passportNumber.trim().toUpperCase();

    try {
      if (new Date(passportExpiry) < new Date()) {
        return {
          verified: false,
          reference: normalizedPassport,
          error: 'Your passport has expired. Please use a valid passport.',
        };
      }

      if (!faceImage?.trim()) {
        return {
          verified: false,
          reference: normalizedPassport,
          error: 'Face verification image is required. Please complete the liveness check.',
        };
      }

      if (shouldSkipPrembly()) {
        logger.info('PREMBLY_SKIP_VERIFICATION — Passport verification skipped');
        return { verified: true, reference: normalizedPassport };
      }

      logger.info('Calling Prembly Passport + Face API', {
        passport: maskPassportForLog(normalizedPassport),
      });

      const response = await axios.post(
        `${PREMBLY_BASE_URL}/verification/national_passport_with_face`,
        {
          number: normalizedPassport,
          last_name: profile.lastName.trim(),
          image: faceImage.trim(),
        },
        { headers: getHeaders(), timeout: 60000 }
      );

      const result = response.data;
      const isSuccess =
        result.status === true || result.response_code === '00';

      if (!isSuccess) {
        return {
          verified: false,
          reference: normalizedPassport,
          error:
            result.detail ||
            result.message ||
            'Passport verification failed. Please check your passport details.',
        };
      }

      const passportData = result.passport_data || result.data || {};
      const providerReference =
        result.verification?.reference?.toString() || normalizedPassport;

      const faceData = result.face_data;
      if (faceData && faceData.status !== true) {
        return {
          verified: false,
          reference: providerReference,
          data: passportData,
          error:
            faceData.message ||
            'Face on your passport does not match your selfie. Please try again with good lighting.',
        };
      }

      if (passportData.expiry_date) {
        const apiExpiry = new Date(passportData.expiry_date);
        if (!Number.isNaN(apiExpiry.getTime()) && apiExpiry < new Date()) {
          return {
            verified: false,
            reference: providerReference,
            data: passportData,
            error: 'Your passport has expired. Please use a valid passport.',
          };
        }
      }

      const firstNameMatch = this.nameMatch(
        passportData.first_name || passportData.firstname || '',
        profile.firstName
      );
      const lastNameMatch = this.nameMatch(
        passportData.last_name || passportData.surname || '',
        profile.lastName
      );

      if (!firstNameMatch || !lastNameMatch) {
        return {
          verified: false,
          reference: providerReference,
          data: passportData,
          error:
            'The name on your passport does not match your profile name. Please update your first name and last name to exactly match your passport.',
        };
      }

      logger.info('Passport verified successfully', {
        providerReference,
        responseCode: result.response_code,
        faceConfidence: faceData?.confidence,
      });
      return {
        verified: true,
        reference: providerReference,
        data: { ...passportData, face_data: faceData },
      };
    } catch (error: any) {
      logger.error('Passport API failed', {
        error: error.message,
        status: error.response?.status,
        detail: error.response?.data?.detail,
      });
      return {
        verified: false,
        reference: normalizedPassport,
        error:
          error.response?.data?.detail ||
          error.response?.data?.message ||
          'Passport verification failed. Please try again later.',
      };
    }
  }

  // ============================================
  // NAME MATCH HELPER
  // ============================================
  private static nameMatch(apiName: string, profileName: string): boolean {
    if (!apiName || !profileName) return false;
    const api = apiName.toLowerCase().trim();
    const profile = profileName.toLowerCase().trim();
    return api.includes(profile) || profile.includes(api);
  }
}