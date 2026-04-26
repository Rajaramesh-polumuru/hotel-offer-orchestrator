import Redis from 'ioredis';
import { config } from './config';
import { HotelResponse } from './types';
import { logger } from './logger';

class RedisService {
  private client: Redis;

  constructor() {
    this.client = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        return Math.min(times * 50, 2000);
      }
    });

    this.client.on('error', (err) => logger.error({ err }, 'Redis connection error'));
  }

  public getClient() {
    return this.client;
  }

  public async isHealthy(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  public async cacheHotels(city: string, hotels: HotelResponse[]): Promise<void> {
    const cityKey = city.toLowerCase();
    const sortedSetKey = `hotels:price:${cityKey}`;
    const hashKey = `hotels:data:${cityKey}`;

    const pipeline = this.client.multi();

    // 1. Delete old keys to ensure fresh data
    pipeline.del(sortedSetKey, hashKey);

    if (hotels.length > 0) {
      // 2. Add to sorted set and hash
      const zaddArgs: (string | number)[] = [];
      const hsetArgs: string[] = [];

      for (const hotel of hotels) {
        zaddArgs.push(hotel.price, hotel.name);
        hsetArgs.push(hotel.name, JSON.stringify(hotel));
      }

      pipeline.zadd(sortedSetKey, ...zaddArgs);
      pipeline.hset(hashKey, ...hsetArgs);

      // 3. Set TTL
      pipeline.expire(sortedSetKey, config.cacheTtlSeconds);
      pipeline.expire(hashKey, config.cacheTtlSeconds);
    }

    await pipeline.exec();
    logger.info({ city, count: hotels.length }, 'Cached hotels to Redis');
  }

  public async getFilteredHotels(city: string, minPrice: number, maxPrice: number): Promise<HotelResponse[]> {
    const cityKey = city.toLowerCase();
    const sortedSetKey = `hotels:price:${cityKey}`;
    const hashKey = `hotels:data:${cityKey}`;

    // 1. Get names of hotels within price range
    const hotelNames = await this.client.zrange(sortedSetKey, minPrice, maxPrice, 'BYSCORE');
    
    if (!hotelNames || hotelNames.length === 0) {
      return [];
    }

    // 2. Get full details from hash
    const hotelDataStrings = await this.client.hmget(hashKey, ...hotelNames);

    const results: HotelResponse[] = [];
    for (const dataStr of hotelDataStrings) {
      if (dataStr) {
        try {
          results.push(JSON.parse(dataStr));
        } catch (e) {
          logger.error({ err: e, dataStr }, 'Failed to parse hotel data from Redis');
        }
      }
    }

    return results;
  }
}

export const redisService = new RedisService();
