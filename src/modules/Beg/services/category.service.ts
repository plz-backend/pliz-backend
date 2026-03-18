import prisma from '../../../config/database';
import redisClient from '../../../config/redis';
import logger from '../../../config/logger';

const CACHE_KEY = 'categories:all';
const CACHE_TTL = 86400; // 24 hours

interface CategoryCache {
  [name: string]: {
    id: string;
    name: string;
    slug: string;
    icon: string;
  };
}

export class CategoryService {
  /**
   * Get category UUID by name (cached)
   * This is FAST - Redis lookup, no database hit
   */
  static async getCategoryIdByName(name: string): Promise<string | null> {
    try {
      // Try cache first
      const cached = await redisClient.getClient().get(CACHE_KEY);
      
      if (cached) {
        const categories: CategoryCache = JSON.parse(cached);
        const category = categories[name.toLowerCase()];
        return category ? category.id : null;
      }

      // Cache miss - load from database
      await this.loadCategoriesToCache();

      // Try again from cache
      const refreshed = await redisClient.getClient().get(CACHE_KEY);
      if (refreshed) {
        const categories: CategoryCache = JSON.parse(refreshed);
        const category = categories[name.toLowerCase()];
        return category ? category.id : null;
      }

      return null;
    } catch (error: any) {
      logger.error('Failed to get category ID', { error: error.message, name });
      return null;
    }
  }

  /**
   * Load all categories into Redis cache
   * Called on app startup and when cache expires
   */
  static async loadCategoriesToCache(): Promise<void> {
    try {
      const categories = await prisma.category.findMany({
        where: { isActive: true },
        select: { id: true, name: true, slug: true, icon: true },
      });

      const categoryMap: CategoryCache = {};
      
      for (const cat of categories) {
        categoryMap[cat.name.toLowerCase()] = {
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          icon: cat.icon || '📦',
        };
      }

      await redisClient.getClient().setEx(
        CACHE_KEY,
        CACHE_TTL,
        JSON.stringify(categoryMap)
      );

      logger.info('Categories loaded to cache', { count: categories.length });
    } catch (error: any) {
      logger.error('Failed to load categories to cache', { error: error.message });
    }
  }

  /**
   * Invalidate cache (call when categories are updated)
   */
  static async invalidateCache(): Promise<void> {
    try {
      await redisClient.getClient().del(CACHE_KEY);
      logger.info('Categories cache invalidated');
    } catch (error: any) {
      logger.error('Failed to invalidate cache', { error: error.message });
    }
  }

  /**
   * Get all categories (cached)
   */
  static async getAllCategories() {
    try {
      const cached = await redisClient.getClient().get(CACHE_KEY);
      
      if (cached) {
        const categoryMap: CategoryCache = JSON.parse(cached);
        return Object.values(categoryMap);
      }

      // Load to cache
      await this.loadCategoriesToCache();

      const refreshed = await redisClient.getClient().get(CACHE_KEY);
      if (refreshed) {
        const categoryMap: CategoryCache = JSON.parse(refreshed);
        return Object.values(categoryMap);
      }

      return [];
    } catch (error: any) {
      logger.error('Failed to get all categories', { error: error.message });
      return [];
    }
  }

  /**
   * Get all active categories (cached)
   * Alias for getAllCategories - cache only stores active ones
   */
  static async getActiveCategories() {
    return this.getAllCategories();
  }

  /**
   * Validate category exists and is active
   */
  static async validateCategory(categoryId: string): Promise<boolean> {
    try {
      const category = await prisma.category.findUnique({
        where: { id: categoryId, isActive: true },
      });
      return !!category;
    } catch (error: any) {
      logger.error('Failed to validate category', { error: error.message });
      return false;
    }
  }
}