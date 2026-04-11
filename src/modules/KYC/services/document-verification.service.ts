import axios from 'axios';
import {
  TextractClient,
  DetectDocumentTextCommand,
} from '@aws-sdk/client-textract';
import { NINDocumentType, IDocumentVerificationResult } from '../types/kyc.interface';
import logger from '../../../config/logger';

export class DocumentVerificationService {

  private static textract = new TextractClient({
    region: process.env.AWS_REGION || 'eu-west-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  // ============================================
  // NIN DOCUMENT VERIFICATION
  // slip    → front only
  // id_card → front + back
  // ============================================
  static async verifyNINDocument(
    nin: string,
    ninFrontUrl: string,
    firstName: string,
    lastName: string,
    ninDocumentType: NINDocumentType,
    ninBackUrl?: string,
  ): Promise<IDocumentVerificationResult> {
    try {
      // Step 1: Extract front text — always required
      const frontText = await this.extractTextFromUrl(ninFrontUrl);
      if (!frontText) {
        return {
          valid: false,
          error: 'Could not read your NIN document. Please scan again in good lighting, hold the camera steady, and make sure the full document is visible.',
        };
      }

      // Step 2: Extract back text — only for id_card
      let backText = '';
      if (ninDocumentType === 'id_card') {
        if (!ninBackUrl) {
          return {
            valid: false,
            error: 'Back of NIN card is required. Please scan both sides of your NIN card.',
          };
        }
        const extracted = await this.extractTextFromUrl(ninBackUrl);
        if (!extracted) {
          return {
            valid: false,
            error: 'Could not read the back of your NIN card. Please scan again in good lighting.',
          };
        }
        backText = extracted;
      }

      // Step 3: Combine all text
      const fullText = `${frontText} ${backText}`;
      const lowerText = fullText.toLowerCase();

      // Step 4: Check NIN number is in document
      if (!fullText.includes(nin)) {
        return {
          valid: false,
          error: `NIN number ${nin} was not found in your scan. Please make sure you scanned the correct document and the number is clearly visible.`,
        };
      }

      // Step 5: Check name matches profile
      const firstNameInDoc = lowerText.includes(firstName.toLowerCase());
      const lastNameInDoc = lowerText.includes(lastName.toLowerCase());
      if (!firstNameInDoc || !lastNameInDoc) {
        return {
          valid: false,
          error: 'The name on your NIN document does not match your profile name. Please update your profile name to match your NIN document exactly.',
        };
      }

      // Step 6: Confirm it is a NIN document
      const isNINDoc =
        lowerText.includes('national') ||
        lowerText.includes('identity') ||
        lowerText.includes('nimc') ||
        lowerText.includes('federal republic');

      if (!isNINDoc) {
        return {
          valid: false,
          error: ninDocumentType === 'slip'
            ? 'This does not appear to be a NIN slip. Please scan your NIMC NIN slip.'
            : 'This does not appear to be a NIN card. Please scan the correct document.',
        };
      }

      // Step 7: For id_card — confirm both sides match
      if (ninDocumentType === 'id_card' && backText) {
        const nameOnBack =
          backText.toLowerCase().includes(firstName.toLowerCase()) ||
          backText.toLowerCase().includes(lastName.toLowerCase());
        if (!nameOnBack) {
          return {
            valid: false,
            error: 'The front and back scans do not match. Please make sure you scanned both sides of the same card.',
          };
        }
      }

      logger.info('NIN document verified', { nin, ninDocumentType });
      return {
        valid: true,
        extractedNumber: nin,
        extractedName: `${firstName} ${lastName}`,
      };
    } catch (error: any) {
      logger.error('NIN document verification error', { error: error.message });
      return {
        valid: false,
        error: 'Could not verify your NIN document. Please try again with a clearer scan.',
      };
    }
  }

  // ============================================
  // PASSPORT DOCUMENT VERIFICATION
  // Biodata page only
  // ============================================
  static async verifyPassportDocument(
    passportNumber: string,
    passportBiodataUrl: string,
    firstName: string,
    lastName: string,
  ): Promise<IDocumentVerificationResult> {
    try {
      const text = await this.extractTextFromUrl(passportBiodataUrl);
      if (!text) {
        return {
          valid: false,
          error: 'Could not read your passport. Please scan the biodata page (the page with your photo) in good lighting with the full page visible.',
        };
      }

      const lowerText = text.toLowerCase();

      // Check passport number
      if (!text.toUpperCase().includes(passportNumber.toUpperCase())) {
        return {
          valid: false,
          error: `Passport number ${passportNumber} was not found in your scan. Please make sure you scanned the biodata page correctly and the number is clearly visible.`,
        };
      }

      // Check name
      const firstNameInDoc = lowerText.includes(firstName.toLowerCase());
      const lastNameInDoc = lowerText.includes(lastName.toLowerCase());
      if (!firstNameInDoc || !lastNameInDoc) {
        return {
          valid: false,
          error: 'The name on your passport does not match your profile name. Please update your profile name to match your passport exactly.',
        };
      }

      // Confirm it is a passport
      const isPassport =
        lowerText.includes('passport') ||
        lowerText.includes('republic of nigeria') ||
        lowerText.includes('nationality') ||
        lowerText.includes('date of birth') ||
        lowerText.includes('date of expiry');

      if (!isPassport) {
        return {
          valid: false,
          error: 'This does not appear to be a passport biodata page. Please scan the page that contains your photo, name, and passport number.',
        };
      }

      // Check MRZ if present
      const mrzMatch = text.match(/[A-Z0-9<]{44}/g);
      if (mrzMatch) {
        const mrzValid = mrzMatch.some(line =>
          line.includes(passportNumber.toUpperCase())
        );
        if (!mrzValid) {
          return {
            valid: false,
            error: 'Passport number does not match the document MRZ. Please check and try again.',
          };
        }
      }

      logger.info('Passport document verified', { passportNumber });
      return {
        valid: true,
        extractedNumber: passportNumber,
        extractedName: `${firstName} ${lastName}`,
      };
    } catch (error: any) {
      logger.error('Passport document verification error', { error: error.message });
      return {
        valid: false,
        error: 'Could not verify your passport. Please try again with a clearer scan.',
      };
    }
  }

  // ============================================
  // OCR — Extract text from scanned image URL
  // ============================================
  private static async extractTextFromUrl(imageUrl: string): Promise<string | null> {
    try {
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(response.data);

      const command = new DetectDocumentTextCommand({
        Document: { Bytes: imageBuffer },
      });

      const result = await this.textract.send(command);

      const text = result.Blocks
        ?.filter(block => block.BlockType === 'LINE' && block.Text)
        .map(block => block.Text)
        .join(' ') || '';

      return text || null;
    } catch (error: any) {
      logger.error('OCR extraction failed', { error: error.message, url: imageUrl });
      return null;
    }
  }
}