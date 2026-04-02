import prisma from '../../../config/database';
import {
  IStory,
  IStoryResponse,
  IAdminStoryResponse,
  ICreateStoryRequest,
  IUpdateStoryRequest,
  IRejectStoryRequest,
} from '../types/story.interface';
import logger from '../../../config/logger';

const MAX_STORY_WORDS = 60;
const MAX_STORY_LENGTH = 500;

export class StoryService {

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private static validateContent(content: string): void {
    const trimmed = content.trim();

    if (trimmed.length < 10) {
      throw new Error('Story must be at least 10 characters');
    }
    if (trimmed.length > MAX_STORY_LENGTH) {
      throw new Error(`Story cannot exceed ${MAX_STORY_LENGTH} characters`);
    }

    const wordCount = trimmed.split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount > MAX_STORY_WORDS) {
      throw new Error(`Story cannot exceed ${MAX_STORY_WORDS} words (currently ${wordCount} words)`);
    }
  }

  private static transformStoryResponse(story: any): IStoryResponse {
    const isAnonymous = story.user?.profile?.isAnonymous || false;

    return {
      id: story.id,
      content: story.content,
      isApproved: story.isApproved,
      isVisible: story.isVisible,
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
      user: {
        username: isAnonymous
          ? 'Anonymous'
          : story.user?.profile?.displayName || story.user?.username,
        displayName: isAnonymous ? undefined : story.user?.profile?.displayName || undefined,
        firstName: isAnonymous ? undefined : story.user?.profile?.firstName || undefined,
        lastName: isAnonymous ? undefined : story.user?.profile?.lastName || undefined,
        isAnonymous,
      },
    };
  }

  private static transformAdminStoryResponse(story: any): IAdminStoryResponse {
    return {
      ...this.transformStoryResponse(story),
      userId: story.userId,
      approvedAt: story.approvedAt,
      approvedBy: story.approvedBy,
      rejectedAt: story.rejectedAt,
      rejectedBy: story.rejectedBy,
      rejectionReason: story.rejectionReason,
    };
  }

  private static includeUserProfile() {
    return {
      user: {
        select: {
          username: true,
          profile: {
            select: {
              displayName: true,
              firstName: true,
              lastName: true,
              isAnonymous: true,
            },
          },
        },
      },
    };
  }

  // ============================================
  // USER METHODS
  // ============================================

  /**
   * Create a story
   */
  static async createStory(userId: string, data: ICreateStoryRequest): Promise<IStory> {
    try {
      this.validateContent(data.content);

      // One pending story per user at a time
      const existing = await prisma.story.findFirst({
        where: { userId, isApproved: false, rejectedAt: null },
      });

      if (existing) {
        throw new Error('You already have a story pending approval. Please wait for it to be reviewed.');
      }

      const story = await prisma.story.create({
        data: {
          userId,
          content: data.content.trim(),
        },
      });

      logger.info('Story created', { storyId: story.id, userId });
      return story;
    } catch (error: any) {
      logger.error('Failed to create story', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Update own story — only allowed if not yet approved
   */
  static async updateStory(
    storyId: string,
    userId: string,
    data: IUpdateStoryRequest
  ): Promise<IStory> {
    try {
      this.validateContent(data.content);

      const story = await prisma.story.findUnique({ where: { id: storyId } });

      if (!story) throw new Error('Story not found');
      if (story.userId !== userId) throw new Error('Unauthorized to update this story');
      if (story.isApproved) {
        throw new Error('Approved stories cannot be edited. Contact support if changes are needed.');
      }

      const updated = await prisma.story.update({
        where: { id: storyId },
        data: { content: data.content.trim() },
      });

      logger.info('Story updated', { storyId, userId });
      return updated;
    } catch (error: any) {
      logger.error('Failed to update story', { error: error.message, storyId, userId });
      throw error;
    }
  }

  /**
   * Delete own story
   */
  static async deleteStory(storyId: string, userId: string): Promise<void> {
    try {
      const story = await prisma.story.findUnique({ where: { id: storyId } });

      if (!story) throw new Error('Story not found');
      if (story.userId !== userId) throw new Error('Unauthorized to delete this story');

      await prisma.story.delete({ where: { id: storyId } });

      logger.info('Story deleted', { storyId, userId });
    } catch (error: any) {
      logger.error('Failed to delete story', { error: error.message, storyId, userId });
      throw error;
    }
  }

  /**
   * Get approved public stories (community feed)
   */
  static async getApprovedStories(
    page: number = 1,
    limit: number = 10
  ): Promise<{ stories: IStoryResponse[]; total: number; pages: number }> {
    try {
      const skip = (page - 1) * limit;

      const [stories, total] = await Promise.all([
        prisma.story.findMany({
          where: { isApproved: true, isVisible: true },
          skip,
          take: limit,
          orderBy: { approvedAt: 'desc' },
          include: this.includeUserProfile(),
        }),
        prisma.story.count({ where: { isApproved: true, isVisible: true } }),
      ]);

      return {
        stories: stories.map(s => this.transformStoryResponse(s)),
        total,
        pages: Math.ceil(total / limit),
      };
    } catch (error: any) {
      logger.error('Failed to get stories', { error: error.message });
      throw error;
    }
  }

  /**
   * Get user's own stories (all statuses)
   */
  static async getMyStories(userId: string): Promise<IStory[]> {
    try {
      return await prisma.story.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error: any) {
      logger.error('Failed to get user stories', { error: error.message, userId });
      throw error;
    }
  }

  // ============================================
  // ADMIN METHODS
  // ============================================

  /**
   * Get all stories — with filters (admin)
   */
  static async getAllStories(
    page: number = 1,
    limit: number = 20,
    filter: 'all' | 'pending' | 'approved' | 'rejected' = 'all'
  ): Promise<{ stories: IAdminStoryResponse[]; total: number; pages: number }> {
    try {
      const skip = (page - 1) * limit;

      const where: any = {};
      if (filter === 'pending') {
        where.isApproved = false;
        where.rejectedAt = null;
      } else if (filter === 'approved') {
        where.isApproved = true;
      } else if (filter === 'rejected') {
        where.rejectedAt = { not: null };
      }

      const [stories, total] = await Promise.all([
        prisma.story.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: this.includeUserProfile(),
        }),
        prisma.story.count({ where }),
      ]);

      return {
        stories: stories.map(s => this.transformAdminStoryResponse(s)),
        total,
        pages: Math.ceil(total / limit),
      };
    } catch (error: any) {
      logger.error('Failed to get all stories (admin)', { error: error.message });
      throw error;
    }
  }

  /**
   * Get single story by ID (admin)
   */
  static async getStoryById(storyId: string): Promise<IAdminStoryResponse> {
    try {
      const story = await prisma.story.findUnique({
        where: { id: storyId },
        include: this.includeUserProfile(),
      });

      if (!story) throw new Error('Story not found');

      return this.transformAdminStoryResponse(story);
    } catch (error: any) {
      logger.error('Failed to get story by ID', { error: error.message, storyId });
      throw error;
    }
  }

  /**
   * Approve a story (admin)
   */
  static async approveStory(storyId: string, adminId: string): Promise<IAdminStoryResponse> {
    try {
      const story = await prisma.story.findUnique({ where: { id: storyId } });

      if (!story) throw new Error('Story not found');
      if (story.isApproved) throw new Error('Story is already approved');
      if (story.rejectedAt) throw new Error('Cannot approve a rejected story. Delete it instead.');

      const updated = await prisma.story.update({
        where: { id: storyId },
        data: {
          isApproved: true,
          approvedAt: new Date(),
          approvedBy: adminId,
          isVisible: true,
        },
        include: this.includeUserProfile(),
      });

      // Log admin action
      await prisma.adminAction.create({
        data: {
          adminId,
          actionType: 'approve_story',
          targetType: 'story',
          targetId: storyId,
          description: `Approved story by user ${story.userId}`,
        },
      });

      logger.info('Story approved', { storyId, adminId });
      return this.transformAdminStoryResponse(updated);
    } catch (error: any) {
      logger.error('Failed to approve story', { error: error.message, storyId, adminId });
      throw error;
    }
  }

  /**
   * Reject a story (admin)
   */
  static async rejectStory(
    storyId: string,
    adminId: string,
    data: IRejectStoryRequest
  ): Promise<IAdminStoryResponse> {
    try {
      const story = await prisma.story.findUnique({ where: { id: storyId } });

      if (!story) throw new Error('Story not found');
      if (story.isApproved) throw new Error('Cannot reject an already approved story.');
      if (story.rejectedAt) throw new Error('Story has already been rejected.');

      const updated = await prisma.story.update({
        where: { id: storyId },
        data: {
          rejectedAt: new Date(),
          rejectedBy: adminId,
          rejectionReason: data.reason.trim(),
          isVisible: false,
        },
        include: this.includeUserProfile(),
      });

      // Log admin action
      await prisma.adminAction.create({
        data: {
          adminId,
          actionType: 'reject_story',
          targetType: 'story',
          targetId: storyId,
          description: `Rejected story by user ${story.userId}. Reason: ${data.reason}`,
        },
      });

      logger.info('Story rejected', { storyId, adminId, reason: data.reason });
      return this.transformAdminStoryResponse(updated);
    } catch (error: any) {
      logger.error('Failed to reject story', { error: error.message, storyId, adminId });
      throw error;
    }
  }

  /**
   * Toggle story visibility (admin — hide/show without deleting)
   */
  static async toggleVisibility(storyId: string, adminId: string): Promise<IAdminStoryResponse> {
    try {
      const story = await prisma.story.findUnique({ where: { id: storyId } });
      if (!story) throw new Error('Story not found');

      const updated = await prisma.story.update({
        where: { id: storyId },
        data: { isVisible: !story.isVisible },
        include: this.includeUserProfile(),
      });

      // Log admin action
      await prisma.adminAction.create({
        data: {
          adminId,
          actionType: updated.isVisible ? 'show_story' : 'hide_story',
          targetType: 'story',
          targetId: storyId,
          description: `Story ${updated.isVisible ? 'made visible' : 'hidden'} by admin`,
        },
      });

      logger.info('Story visibility toggled', { storyId, adminId, isVisible: updated.isVisible });
      return this.transformAdminStoryResponse(updated);
    } catch (error: any) {
      logger.error('Failed to toggle story visibility', { error: error.message, storyId });
      throw error;
    }
  }

  /**
   * Admin delete story
   */
  static async adminDeleteStory(storyId: string, adminId: string): Promise<void> {
    try {
      const story = await prisma.story.findUnique({ where: { id: storyId } });
      if (!story) throw new Error('Story not found');

      await prisma.story.delete({ where: { id: storyId } });

      // Log admin action
      await prisma.adminAction.create({
        data: {
          adminId,
          actionType: 'delete_story',
          targetType: 'story',
          targetId: storyId,
          description: `Deleted story belonging to user ${story.userId}`,
        },
      });

      logger.info('Story deleted by admin', { storyId, adminId });
    } catch (error: any) {
      logger.error('Failed to delete story (admin)', { error: error.message, storyId });
      throw error;
    }
  }
}