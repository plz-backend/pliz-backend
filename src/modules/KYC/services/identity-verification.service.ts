import axios from 'axios';
import logger from '../../../config/logger';
import { IPremblyVerificationResult } from '../types/kyc.interface';

const PREMBLY_BASE_URL = 'https://api.prembly.com';

const getHeaders = () => ({
  'x-api-key': process.env.PREMBLY_API_KEY!,
  'app-id': process.env.PREMBLY_APP_ID!,
  'Content-Type': 'application/json',
});

export class IdentityVerificationService {

  // ============================================
  // VERIFY NIN
  // ============================================
  static async verifyNIN(
    nin: string,
    profile: {
      firstName: string;
      lastName: string;
      dateOfBirth: Date | null;
      gender: string | null;
      phoneNumber: string | null;
    },
    ninFormData: {
      ninMiddleName?: string | null;
      ninStateOfOrigin: string;
      ninLGA: string;
      ninEnrollmentDate: string;
    }
  ): Promise<IPremblyVerificationResult> {
    try {
      if (process.env.NODE_ENV === 'development') {
        logger.info('DEV MODE — NIN verification skipped');
        return { verified: true, reference: nin };
      }

      const requestBody: any = {
        number: nin,
        firstname: profile.firstName,
        lastname: profile.lastName,
      };

      if (profile.dateOfBirth) {
        requestBody.dob = profile.dateOfBirth.toISOString().split('T')[0];
      }
      if (profile.gender) {
        requestBody.gender = profile.gender === 'male' ? 'M' : 'F';
      }
      if (ninFormData.ninMiddleName) {
        requestBody.middlename = ninFormData.ninMiddleName;
      }

      logger.info('Calling Prembly NIN API', {
        nin: nin.substring(0, 4) + '****',
      });

      const response = await axios.post(
        `${PREMBLY_BASE_URL}/identitypass/verification/nin`,
        requestBody,
        { headers: getHeaders(), timeout: 30000 }
      );

      const result = response.data;

      if (!result.status) {
        return {
          verified: false,
          reference: nin,
          error: result.detail ||
            'NIN verification failed. Please check your NIN and try again.',
        };
      }

      const ninData = result.nin_data || result.data || {};

      // Check name match
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
          reference: nin,
          data: ninData,
          error: 'The name on your NIN does not match your profile name. Please update your first name and last name to exactly match your NIN.',
        };
      }

      logger.info('NIN verified successfully');
      return { verified: true, reference: nin, data: ninData };
    } catch (error: any) {
      logger.error('NIN API failed', { error: error.message });
      return {
        verified: false,
        reference: nin,
        error: error.response?.data?.detail ||
          'NIN verification failed. Please try again later.',
      };
    }
  }

  // ============================================
  // VERIFY PASSPORT
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
    passportFormData: {
      passportMiddleName?: string | null;
      passportPlaceOfBirth: string;
      passportIssueDate: string;
      passportPlaceOfIssue: string;
    }
  ): Promise<IPremblyVerificationResult> {
    try {
      if (new Date(passportExpiry) < new Date()) {
        return {
          verified: false,
          reference: passportNumber,
          error: 'Your passport has expired. Please use a valid passport.',
        };
      }

      if (process.env.NODE_ENV === 'development') {
        logger.info('DEV MODE — Passport verification skipped');
        return { verified: true, reference: passportNumber };
      }

      const requestBody: any = {
        number: passportNumber,
        last_name: profile.lastName,
        first_name: profile.firstName,
      };

      if (profile.dateOfBirth) {
        requestBody.dob = profile.dateOfBirth.toISOString().split('T')[0];
      }
      if (profile.gender) {
        requestBody.gender = profile.gender === 'male' ? 'M' : 'F';
      }
      if (passportFormData.passportMiddleName) {
        requestBody.middle_name = passportFormData.passportMiddleName;
      }

      logger.info('Calling Prembly Passport API', {
        passport: passportNumber.substring(0, 3) + '****',
      });

      const response = await axios.post(
        `${PREMBLY_BASE_URL}/identitypass/verification/passport`,
        requestBody,
        { headers: getHeaders(), timeout: 30000 }
      );

      const result = response.data;

      if (!result.status) {
        return {
          verified: false,
          reference: passportNumber,
          error: result.detail ||
            'Passport verification failed. Please check your passport details.',
        };
      }

      logger.info('Passport verified successfully');
      return {
        verified: true,
        reference: passportNumber,
        data: result.passport_data || result.data,
      };
    } catch (error: any) {
      logger.error('Passport API failed', { error: error.message });
      return {
        verified: false,
        reference: passportNumber,
        error: error.response?.data?.detail ||
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