import Redis from 'ioredis-mock';
import { HotelResponse } from '../types';

jest.mock('../config', () => ({
  config: {
    redisUrl: 'redis://localhost:6379',
    cacheTtlSeconds: 300,
  },
}));

jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('ioredis', () => {
  const RedisMock = require('ioredis-mock');
  return RedisMock;
});

import { redisService } from '../redis';

describe('RedisService', () => {
  const testHotels: HotelResponse[] = [
    { name: 'Holtin', price: 5340, supplier: 'B', commissionPct: 20 },
    { name: 'Radison', price: 5900, supplier: 'A', commissionPct: 13 },
    { name: 'Taj', price: 12000, supplier: 'B', commissionPct: 20 },
    { name: 'Leela', price: 15000, supplier: 'A', commissionPct: 18 },
  ];

  beforeEach(async () => {
    const client = redisService.getClient();
    await client.flushall();
  });

  afterAll(async () => {
    const client = redisService.getClient();
    await client.quit();
  });

  describe('cacheHotels', () => {
    it('stores hotels in sorted set and hash', async () => {
      await redisService.cacheHotels('delhi', testHotels);

      const client = redisService.getClient();
      const sortedSetMembers = await client.zrange('hotels:price:delhi', 0, -1);
      expect(sortedSetMembers).toHaveLength(4);
      expect(sortedSetMembers).toContain('Holtin');
      expect(sortedSetMembers).toContain('Taj');

      const hashData = await client.hget('hotels:data:delhi', 'Holtin');
      expect(hashData).toBeTruthy();
      const parsed = JSON.parse(hashData!);
      expect(parsed.price).toBe(5340);
      expect(parsed.supplier).toBe('B');
    });

    it('sets correct TTL on both keys', async () => {
      await redisService.cacheHotels('delhi', testHotels);

      const client = redisService.getClient();
      const ttl1 = await client.ttl('hotels:price:delhi');
      const ttl2 = await client.ttl('hotels:data:delhi');

      expect(ttl1).toBeGreaterThan(0);
      expect(ttl1).toBeLessThanOrEqual(300);
      expect(ttl2).toBeGreaterThan(0);
      expect(ttl2).toBeLessThanOrEqual(300);
    });

    it('overwrites previous data', async () => {
      await redisService.cacheHotels('delhi', testHotels);

      const newHotels: HotelResponse[] = [
        { name: 'NewHotel', price: 9999, supplier: 'A', commissionPct: 5 },
      ];
      await redisService.cacheHotels('delhi', newHotels);

      const client = redisService.getClient();
      const members = await client.zrange('hotels:price:delhi', 0, -1);
      expect(members).toHaveLength(1);
      expect(members[0]).toBe('NewHotel');
    });

    it('deletes keys when hotels array is empty', async () => {
      await redisService.cacheHotels('delhi', testHotels);
      await redisService.cacheHotels('delhi', []);

      const client = redisService.getClient();
      const members = await client.zrange('hotels:price:delhi', 0, -1);
      expect(members).toHaveLength(0);
    });

    it('normalizes city key to lowercase', async () => {
      await redisService.cacheHotels('DELHI', testHotels);

      const client = redisService.getClient();
      const members = await client.zrange('hotels:price:delhi', 0, -1);
      expect(members.length).toBeGreaterThan(0);
    });
  });

  describe('getFilteredHotels', () => {
    beforeEach(async () => {
      await redisService.cacheHotels('delhi', testHotels);
    });

    it('returns hotels within price range', async () => {
      const results = await redisService.getFilteredHotels('delhi', 5000, 6000);

      expect(results.length).toBeGreaterThanOrEqual(1);
      for (const hotel of results) {
        expect(hotel.price).toBeGreaterThanOrEqual(5000);
        expect(hotel.price).toBeLessThanOrEqual(6000);
      }
    });

    it('returns exact matches at boundary prices', async () => {
      const results = await redisService.getFilteredHotels('delhi', 5340, 5340);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Holtin');
    });

    it('excludes out-of-range hotels', async () => {
      const results = await redisService.getFilteredHotels('delhi', 5000, 6000);
      const names = results.map(h => h.name);

      expect(names).not.toContain('Taj');
      expect(names).not.toContain('Leela');
    });

    it('returns empty array when no hotels in range', async () => {
      const results = await redisService.getFilteredHotels('delhi', 1, 100);
      expect(results).toEqual([]);
    });

    it('returns empty array when keys do not exist', async () => {
      const results = await redisService.getFilteredHotels('nonexistent', 0, 100000);
      expect(results).toEqual([]);
    });

    it('normalizes city key for filtering', async () => {
      const results = await redisService.getFilteredHotels('DELHI', 5000, 6000);
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('does not cross-contaminate between cities', async () => {
      const mumbaiHotels: HotelResponse[] = [
        { name: 'Marriott', price: 7800, supplier: 'B', commissionPct: 10 },
      ];
      await redisService.cacheHotels('mumbai', mumbaiHotels);

      const delhiResults = await redisService.getFilteredHotels('delhi', 0, 100000);
      const mumbaiResults = await redisService.getFilteredHotels('mumbai', 0, 100000);

      const delhiNames = delhiResults.map(h => h.name);
      expect(delhiNames).not.toContain('Marriott');

      const mumbaiNames = mumbaiResults.map(h => h.name);
      expect(mumbaiNames).toContain('Marriott');
      expect(mumbaiNames).not.toContain('Holtin');
    });
  });

  describe('isHealthy', () => {
    it('returns true when Redis is connected', async () => {
      const result = await redisService.isHealthy();
      expect(result).toBe(true);
    });
  });
});
