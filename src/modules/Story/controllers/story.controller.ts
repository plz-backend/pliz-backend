import { Request, Response } from 'express';
import { StoryService } from '../services/story.service';
import { IApiResponse } from '../../auth/types/user.interface';
import logger from '../../../config/logger';

const sendResponse = <T = any>(
  res: Response,
  statusCode: number,
  response: IApiResponse<T>
): void => {
  res.status(statusCode).json(response);
};

export const getStories = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await StoryService.getApprovedStories(page, limit);

    sendResponse(res, 200, {
      success: true,
      message: 'Community stories retrieved successfully',
      data: result,
    });
  } catch (error: any) {
    logger.error('Get stories error', { error: error.message });
    sendResponse(res, 500, { success: false, message: 'Failed to retrieve stories' });
  }
};

export const getMyStories = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const stories = await StoryService.getMyStories(userId);

    sendResponse(res, 200, {
      success: true,
      message: 'Your stories retrieved successfully',
      data: { stories },
    });
  } catch (error: any) {
    logger.error('Get my stories error', { error: error.message });
    sendResponse(res, 500, { success: false, message: 'Failed to retrieve your stories' });
  }
};

export const createStory = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { content } = req.body;

    const story = await StoryService.createStory(userId, { content });

    sendResponse(res, 201, {
      success: true,
      message: 'Story submitted! It will appear in the community after review.',
      data: { story },
    });
  } catch (error: any) {
    logger.error('Create story error', { error: error.message });
    const statusCode = error.message.includes('pending') ? 409 : 400;
    sendResponse(res, statusCode, { success: false, message: error.message });
  }
};

export const updateStory = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const storyId = req.params.id as string;  // ← fixed
    const { content } = req.body;

    const story = await StoryService.updateStory(storyId, userId, { content });

    sendResponse(res, 200, {
      success: true,
      message: 'Story updated successfully',
      data: { story },
    });
  } catch (error: any) {
    logger.error('Update story error', { error: error.message });
    const statusCode =
      error.message.includes('not found') ? 404 :
      error.message.includes('Unauthorized') ? 403 :
      error.message.includes('Approved') ? 400 : 500;
    sendResponse(res, statusCode, { success: false, message: error.message });
  }
};

export const deleteStory = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const storyId = req.params.id as string;  // ← fixed

    await StoryService.deleteStory(storyId, userId);

    sendResponse(res, 200, { success: true, message: 'Story deleted successfully' });
  } catch (error: any) {
    logger.error('Delete story error', { error: error.message });
    const statusCode =
      error.message.includes('not found') ? 404 :
      error.message.includes('Unauthorized') ? 403 : 500;
    sendResponse(res, statusCode, { success: false, message: error.message });
  }
};