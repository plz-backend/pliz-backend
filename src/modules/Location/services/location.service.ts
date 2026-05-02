import redisClient from '../../../config/redis';
import logger from '../../../config/logger';
import * as nigerianStates from 'nigerian-states-and-lgas';

const CACHE_TTL = 60 * 60 * 24 * 7; // 7 days

const CACHE_KEYS = {
  states: 'location:states',
  allLGAs: 'location:lgas:all',
  passportOffices: 'location:passport_offices',
};

export class LocationService {

  // ============================================
  // GET NIGERIAN STATES
  // ============================================
  static async getNigerianStates(): Promise<string[]> {
    try {
      const cached = await redisClient.getClient().get(CACHE_KEYS.states);
      if (cached) {
        logger.info('States loaded from cache');
        return JSON.parse(cached);
      }

      const states: string[] = nigerianStates.states().sort();

      await redisClient.getClient().setEx(
        CACHE_KEYS.states,
        CACHE_TTL,
        JSON.stringify(states)
      );

      logger.info('States cached', { count: states.length });

      return states;
    } catch (error: any) {
      logger.error('Failed to get states', { error: error.message });
      return nigerianStates.states().sort();
    }
  }

  // ============================================
  // GET LGAs FOR A SPECIFIC STATE
  // Fixes: string[] | undefined → string[]
  // ============================================
  static async getLGAsForState(state: string): Promise<string[]> {
    try {
      const cacheKey = `location:lgas:${state.toLowerCase()}`;

      const cached = await redisClient.getClient().get(cacheKey);
      if (cached) {
        logger.info('LGAs loaded from cache', { state });
        return JSON.parse(cached);
      }

      // ── FIX: lga() returns string[] | undefined ──
      const rawLGAs: string[] | undefined = nigerianStates.lgas(state);

      if (!rawLGAs || rawLGAs.length === 0) {
        throw new Error(`State "${state}" not found. Please select a valid state.`);
      }

      const sortedLGAs: string[] = [...rawLGAs].sort();

      await redisClient.getClient().setEx(
        cacheKey,
        CACHE_TTL,
        JSON.stringify(sortedLGAs)
      );

      logger.info('LGAs cached', { state, count: sortedLGAs.length });

      return sortedLGAs;
    } catch (error: any) {
      logger.error('Failed to get LGAs', { error: error.message, state });
      throw new Error(`State "${state}" not found. Please select a valid state.`);
    }
  }

  // ============================================
  // GET ALL LGAs (ALL STATES AT ONCE)
  // ============================================
  static async getAllLGAs(): Promise<Record<string, string[]>> {
    try {
      const cached = await redisClient.getClient().get(CACHE_KEYS.allLGAs);
      if (cached) {
        logger.info('All LGAs loaded from cache');
        return JSON.parse(cached);
      }

      // all() returns: [{ state: 'Abia', lgas: [...] }, ...]
      const allData: { state: string; lgas: string[] }[] = nigerianStates.all();
      const allLGAs: Record<string, string[]> = {};

      for (const item of allData) {
        if (item.state && Array.isArray(item.lgas)) {
          allLGAs[item.state] = [...item.lgas].sort();
        }
      }

      await redisClient.getClient().setEx(
        CACHE_KEYS.allLGAs,
        CACHE_TTL,
        JSON.stringify(allLGAs)
      );

      logger.info('All LGAs cached', {
        stateCount: Object.keys(allLGAs).length,
      });

      return allLGAs;
    } catch (error: any) {
      logger.error('Failed to get all LGAs', { error: error.message });
      return {};
    }
  }

  // ============================================
  // GET PASSPORT ISSUING OFFICES
  // Hardcoded — no public API exists for this
  // ============================================
  static async getPassportIssuingOffices(): Promise<string[]> {
    try {
      const cached = await redisClient.getClient().get(CACHE_KEYS.passportOffices);
      if (cached) {
        logger.info('Passport offices loaded from cache');
        return JSON.parse(cached);
      }

      const offices = this.PASSPORT_OFFICES;

      await redisClient.getClient().setEx(
        CACHE_KEYS.passportOffices,
        CACHE_TTL,
        JSON.stringify(offices)
      );

      logger.info('Passport offices cached', { count: offices.length });

      return offices;
    } catch (error: any) {
      logger.error('Failed to get passport offices', { error: error.message });
      return this.PASSPORT_OFFICES;
    }
  }

  // ============================================
  // GET ALL LOCATION DATA IN ONE CALL
  // ============================================
  static async getAllLocationData(): Promise<{
    states: string[];
    lgas: Record<string, string[]>;
    passportOffices: string[];
  }> {
    const [states, lgas, passportOffices] = await Promise.all([
      this.getNigerianStates(),
      this.getAllLGAs(),
      this.getPassportIssuingOffices(),
    ]);

    return { states, lgas, passportOffices };
  }

  // ============================================
  // PRELOAD ALL DATA ON SERVER STARTUP
  // ============================================
  static async preloadLocationData(): Promise<void> {
    try {
      logger.info('Preloading location data...');

      await Promise.all([
        this.getNigerianStates(),
        this.getAllLGAs(),
        this.getPassportIssuingOffices(),
      ]);

      logger.info('✅ Location data preloaded into cache');
    } catch (error: any) {
      logger.warn('⚠️ Location preload failed — will load on first request', {
        error: error.message,
      });
    }
  }

  // ============================================
  // INVALIDATE CACHE — force refresh
  // ============================================
  static async invalidateCache(): Promise<void> {
    try {
      const keys = await redisClient.getClient().keys('location:*');
      if (keys.length > 0) {
        await redisClient.getClient().del(keys);
      }
      logger.info('Location cache invalidated', { keysDeleted: keys.length });
    } catch (error: any) {
      logger.error('Failed to invalidate location cache', {
        error: error.message,
      });
    }
  }

  // ============================================
  // PASSPORT OFFICES — hardcoded list
  // Source: Nigeria Immigration Service
  // ============================================
  private static readonly PASSPORT_OFFICES: string[] = [
    'Abeokuta',
    'Abuja',
    'Asaba',
    'Awka',
    'Bauchi',
    'Benin City',
    'Birnin Kebbi',
    'Calabar',
    'Damaturu',
    'Dutse',
    'Enugu',
    'Gombe',
    'Ibadan',
    'Ilorin',
    'Jalingo',
    'Jos',
    'Kaduna',
    'Kano',
    'Katsina',
    'Lafia',
    'Lagos',
    'Lokoja',
    'Maiduguri',
    'Makurdi',
    'Minna',
    'Nnewi',
    'Osogbo',
    'Owerri',
    'Port Harcourt',
    'Sokoto',
    'Umuahia',
    'Uyo',
    'Warri',
    'Yenagoa',
    'Yola',
    'Zamfara',
  ].sort();
}