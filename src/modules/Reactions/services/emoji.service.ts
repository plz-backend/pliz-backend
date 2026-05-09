import axios from 'axios';
import redisClient from '../../../config/redis';
import logger from '../../../config/logger';
import { IEmojiCategory } from '../types/reaction.interface';

const EMOJI_CACHE_KEY = 'emojis:all';
const EMOJI_CHARS_CACHE_KEY = 'emojis:chars';
const EMOJI_CACHE_TTL = 60 * 60 * 24 * 30; // 30 days

export class EmojiService {

  // ============================================
  // GET ALL EMOJIS
  // From Redis cache or API
  // ============================================
  static async getAllEmojis(): Promise<IEmojiCategory[]> {
    try {
      // Check cache first
      const cached = await redisClient.getClient().get(EMOJI_CACHE_KEY);
      if (cached) {
        logger.info('Emojis loaded from cache');
        return JSON.parse(cached);
      }

      // Not cached — fetch from API
      logger.info('Fetching emojis from API');
      const emojis = await this.fetchFromAPI();

      // Cache for 30 days
      await redisClient.getClient().setEx(
        EMOJI_CACHE_KEY,
        EMOJI_CACHE_TTL,
        JSON.stringify(emojis)
      );

      logger.info('Emojis cached', {
        totalCategories: emojis.length,
        totalEmojis: emojis.reduce((sum, cat) => sum + cat.emojis.length, 0),
      });

      return emojis;
    } catch (error: any) {
      logger.error('Failed to get emojis', { error: error.message });
      // Return fallback if API fails
      return this.getFallbackEmojis();
    }
  }

  // ============================================
  // GET FLAT LIST FOR VALIDATION
  // ============================================
  static async getAllEmojiChars(): Promise<string[]> {
    try {
      const cached = await redisClient.getClient().get(EMOJI_CHARS_CACHE_KEY);
      if (cached) return JSON.parse(cached);

      const categories = await this.getAllEmojis();
      const chars = categories.flatMap(cat => cat.emojis.map(e => e.emoji));

      await redisClient.getClient().setEx(
        EMOJI_CHARS_CACHE_KEY,
        EMOJI_CACHE_TTL,
        JSON.stringify(chars)
      );

      return chars;
    } catch (error: any) {
      logger.error('Failed to get emoji chars', { error: error.message });
      return [];
    }
  }

  // ============================================
  // FETCH FROM EMOJI API
  // ============================================
  private static async fetchFromAPI(): Promise<IEmojiCategory[]> {
    try {
      const response = await axios.get(
        `https://emoji-api.com/emojis?access_key=${process.env.EMOJI_API_KEY}`,
        { timeout: 10000 }
      );

      if (!response.data || !Array.isArray(response.data)) {
        throw new Error('Invalid API response');
      }

      // Group by category
      const categoryMap = new Map<string, any[]>();

      for (const item of response.data) {
        const category = item.category || 'Other';
        if (!categoryMap.has(category)) {
          categoryMap.set(category, []);
        }
        categoryMap.get(category)!.push({
          emoji: item.character,
          name: item.unicodeName || item.slug,
          category: item.category,
          subcategory: item.subCategory || '',
        });
      }

      return Array.from(categoryMap.entries()).map(([category, emojis]) => ({
        category,
        emojis,
      }));
    } catch (error: any) {
      logger.error('Emoji API fetch failed', { error: error.message });
      throw error;
    }
  }

  // ============================================
  // INVALIDATE CACHE — force refresh
  // ============================================
  static async invalidateCache(): Promise<void> {
    await redisClient.getClient().del(EMOJI_CACHE_KEY);
    await redisClient.getClient().del(EMOJI_CHARS_CACHE_KEY);
    logger.info('Emoji cache cleared');
  }

  // ============================================
  // FALLBACK — if API is down
  // ============================================
  private static getFallbackEmojis(): IEmojiCategory[] {
    return [
      {
        category: 'Smileys & Emotion',
        emojis: [
          { emoji: '😀', name: 'grinning face', category: 'Smileys & Emotion', subcategory: '' },
          { emoji: '😂', name: 'face with tears of joy', category: 'Smileys & Emotion', subcategory: '' },
          { emoji: '😍', name: 'smiling face with heart-eyes', category: 'Smileys & Emotion', subcategory: '' },
          { emoji: '😢', name: 'crying face', category: 'Smileys & Emotion', subcategory: '' },
          { emoji: '😭', name: 'loudly crying face', category: 'Smileys & Emotion', subcategory: '' },
          { emoji: '🥺', name: 'pleading face', category: 'Smileys & Emotion', subcategory: '' },
          { emoji: '😊', name: 'smiling face', category: 'Smileys & Emotion', subcategory: '' },
          { emoji: '🥰', name: 'smiling face with hearts', category: 'Smileys & Emotion', subcategory: '' },
          { emoji: '😇', name: 'smiling face with halo', category: 'Smileys & Emotion', subcategory: '' },
          { emoji: '🤩', name: 'star-struck', category: 'Smileys & Emotion', subcategory: '' },
        ],
      },
      {
        category: 'People & Body',
        emojis: [
          { emoji: '🙏', name: 'folded hands', category: 'People & Body', subcategory: '' },
          { emoji: '👏', name: 'clapping hands', category: 'People & Body', subcategory: '' },
          { emoji: '🤝', name: 'handshake', category: 'People & Body', subcategory: '' },
          { emoji: '👍', name: 'thumbs up', category: 'People & Body', subcategory: '' },
          { emoji: '🫶', name: 'heart hands', category: 'People & Body', subcategory: '' },
          { emoji: '💪', name: 'flexed biceps', category: 'People & Body', subcategory: '' },
          { emoji: '🤲', name: 'palms up together', category: 'People & Body', subcategory: '' },
          { emoji: '🫂', name: 'people hugging', category: 'People & Body', subcategory: '' },
        ],
      },
      {
        category: 'Symbols',
        emojis: [
          { emoji: '❤️', name: 'red heart', category: 'Symbols', subcategory: '' },
          { emoji: '🧡', name: 'orange heart', category: 'Symbols', subcategory: '' },
          { emoji: '💛', name: 'yellow heart', category: 'Symbols', subcategory: '' },
          { emoji: '💚', name: 'green heart', category: 'Symbols', subcategory: '' },
          { emoji: '💙', name: 'blue heart', category: 'Symbols', subcategory: '' },
          { emoji: '💜', name: 'purple heart', category: 'Symbols', subcategory: '' },
          { emoji: '💯', name: 'hundred points', category: 'Symbols', subcategory: '' },
          { emoji: '✨', name: 'sparkles', category: 'Symbols', subcategory: '' },
          { emoji: '🔥', name: 'fire', category: 'Symbols', subcategory: '' },
          { emoji: '🎉', name: 'party popper', category: 'Symbols', subcategory: '' },
        ],
      },
    ];
  }
}