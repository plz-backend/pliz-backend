import { Request, Response } from 'express';
import { StoryService } from '../../../Story/services/story.service';
import { IApiResponse } from '../../../auth/types/user.interface';
import logger from '../../../../config/logger';

const sendResponse = <T = any>(
  res: Response,
  statusCode: number,
  response: IApiResponse<T>
): void => {
  res.status(statusCode).json(response);
};

export const adminGetStories = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const filter = (req.query.filter as 'all' | 'pending' | 'approved' | 'rejected') || 'all';

    const result = await StoryService.getAllStories(page, limit, filter);

    sendResponse(res, 200, {
      success: true,
      message: 'Stories retrieved successfully',
      data: result,
    });
  } catch (error: any) {
    logger.error('Admin get stories error', { error: error.message });
    sendResponse(res, 500, { success: false, message: 'Failed to retrieve stories' });
  }
};

export const adminGetStoryById = async (req: Request, res: Response): Promise<void> => {
  try {
    const storyId = req.params.id as string;  // ← cast

    const story = await StoryService.getStoryById(storyId);

    sendResponse(res, 200, {
      success: true,
      message: 'Story retrieved successfully',
      data: { story },
    });
  } catch (error: any) {
    logger.error('Admin get story error', { error: error.message });
    const statusCode = error.message.includes('not found') ? 404 : 500;
    sendResponse(res, statusCode, { success: false, message: error.message });
  }
};

export const adminApproveStory = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = (req as any).user?.userId;
    const storyId = req.params.id as string;  // ← cast

    const story = await StoryService.approveStory(storyId, adminId);

    sendResponse(res, 200, {
      success: true,
      message: 'Story approved and is now live in the community feed',
      data: { story },
    });
  } catch (error: any) {
    logger.error('Admin approve story error', { error: error.message });
    const statusCode =
      error.message.includes('not found') ? 404 :
      error.message.includes('already') ? 400 : 500;
    sendResponse(res, statusCode, { success: false, message: error.message });
  }
};

export const adminRejectStory = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = (req as any).user?.userId;
    const storyId = req.params.id as string;  // ← cast
    const { reason } = req.body;

    const story = await StoryService.rejectStory(storyId, adminId, { reason });

    sendResponse(res, 200, {
      success: true,
      message: 'Story rejected successfully',
      data: { story },
    });
  } catch (error: any) {
    logger.error('Admin reject story error', { error: error.message });
    const statusCode =
      error.message.includes('not found') ? 404 :
      error.message.includes('already') ? 400 : 500;
    sendResponse(res, statusCode, { success: false, message: error.message });
  }
};

export const adminToggleVisibility = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = (req as any).user?.userId;
    const storyId = req.params.id as string;  // ← cast

    const story = await StoryService.toggleVisibility(storyId, adminId);

    sendResponse(res, 200, {
      success: true,
      message: `Story is now ${story.isVisible ? 'visible' : 'hidden'}`,
      data: { story },
    });
  } catch (error: any) {
    logger.error('Admin toggle story visibility error', { error: error.message });
    const statusCode = error.message.includes('not found') ? 404 : 500;
    sendResponse(res, statusCode, { success: false, message: error.message });
  }
};

export const adminDeleteStory = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = (req as any).user?.userId;
    const storyId = req.params.id as string;  // ← cast

    await StoryService.adminDeleteStory(storyId, adminId);

    sendResponse(res, 200, { success: true, message: 'Story permanently deleted' });
  } catch (error: any) {
    logger.error('Admin delete story error', { error: error.message });
    const statusCode = error.message.includes('not found') ? 404 : 500;
    sendResponse(res, statusCode, { success: false, message: error.message });
  }
};