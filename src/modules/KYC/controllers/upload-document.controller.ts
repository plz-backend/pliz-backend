import { Request, Response } from 'express';
import { KYCService } from '../services/kyc.service';
import { IApiResponse } from '../../auth/types/user.interface';
import logger from '../../../config/logger';

const sendResponse = <T = any>(res: Response, statusCode: number, response: IApiResponse<T>): void => {
  res.status(statusCode).json(response);
};

/**
 * @route   POST /api/kyc/document/upload
 * @desc    Upload NIN document with form data
 * @access  Private
 *
 * NIN FormData:
 * {
 *   document: file,
 *   verificationType: "nin",
 *   documentType: "nin_front" | "nin_back",
 *   nin: "12345678901",
 *   ninDocumentType: "slip" | "card",
 *   ninMiddleName: "Optional",
 *   ninStateOfOrigin: "Lagos",
 *   ninLGA: "Ikeja"
 * }
 */
export const uploadDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    if (!req.file) {
      sendResponse(res, 400, {
        success: false,
        message: 'Please select a document image to upload',
      });
      return;
    }

    const {
      verificationType, documentType,
      nin, ninDocumentType, ninMiddleName,
      ninStateOfOrigin, ninLGA,
    } = req.body;

    const result = await KYCService.uploadDocument(
      userId,
      req.file.buffer,
      req.file.mimetype,
      {
        verificationType,
        documentType,
        nin, ninDocumentType, ninMiddleName,
        ninStateOfOrigin, ninLGA,
      }
    );

    let message = 'Document uploaded successfully. Submit your verification when ready.';

    if (
      verificationType === 'nin' &&
      ninDocumentType === 'card' &&
      documentType === 'nin_front'
    ) {
      message = 'Front of NIN card uploaded. Please now upload the back of your NIN card.';
    }

    sendResponse(res, 200, {
      success: true,
      message,
      data: result,
    });
  } catch (error: any) {
    logger.error('Upload document error', { error: error.message });
    const statusCode =
      error.message.includes('phone') ? 400 :
      error.message.includes('already verified') ? 400 :
      error.message.includes('expired') ? 400 :
      error.message.includes('required') ? 400 :
      error.message.includes('must be') ? 400 :
      error.message.includes('supported') ? 400 :
      error.message.includes('digits') ? 400 :
      error.message.includes('format') ? 400 : 500;
    sendResponse(res, statusCode, { success: false, message: error.message });
  }
};
