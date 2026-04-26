import request from 'supertest';

jest.mock('../../redis', () => ({
  redisService: {
    isHealthy: jest.fn().mockResolvedValue(true),
    getFilteredHotels: jest.fn().mockResolvedValue([]),
    cacheHotels: jest.fn().mockResolvedValue(undefined),
  },
}));

import { createTestApp } from '../../test-utils/app';
import { supplierAData, supplierBData } from '../../data/suppliers';
import { Server } from 'http';

describe('Supplier Routes Integration', () => {
  const app = createTestApp();
  let server: Server;
  let testUrl: string;

  beforeAll((done) => {
    server = app.listen(31001, '127.0.0.1', done);
  });

  afterAll((done) => {
    server.close(done);
  });

  describe('GET /supplierA/hotels', () => {
    it('returns all Supplier A data when no city is provided', async () => {
      const response = await request(server).get('/supplierA/hotels');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(supplierAData.length);
    });

    it('filters Supplier A data by city (case-insensitive)', async () => {
      const response1 = await request(server).get('/supplierA/hotels?city=delhi');
      const response2 = await request(server).get('/supplierA/hotels?city=DELHI');

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.body).toEqual(response2.body);
      
      const delhiCount = supplierAData.filter(h => h.city.toLowerCase() === 'delhi').length;
      expect(response1.body).toHaveLength(delhiCount);
      expect(response1.body.every((h: any) => h.city.toLowerCase() === 'delhi')).toBe(true);
    });

    it('returns empty array for nonexistent city in Supplier A', async () => {
      const response = await request(server).get('/supplierA/hotels?city=nonexistent');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('simulates failure when X-Simulate-Failure header is true', async () => {
      const response = await request(server)
        .get('/supplierA/hotels')
        .set('x-simulate-failure', 'true');
        
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Simulated failure for Supplier A');
    });
  });

  describe('GET /supplierB/hotels', () => {
    it('returns all Supplier B data when no city is provided', async () => {
      const response = await request(server).get('/supplierB/hotels');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(supplierBData.length);
    });

    it('filters Supplier B data by city (case-insensitive)', async () => {
      const response = await request(server).get('/supplierB/hotels?city=mumbai');
      expect(response.status).toBe(200);
      
      const mumbaiCount = supplierBData.filter(h => h.city.toLowerCase() === 'mumbai').length;
      expect(response.body).toHaveLength(mumbaiCount);
      expect(response.body.every((h: any) => h.city.toLowerCase() === 'mumbai')).toBe(true);
    });

    it('returns empty array for nonexistent city in Supplier B', async () => {
      const response = await request(server).get('/supplierB/hotels?city=nonexistent');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('simulates failure when X-Simulate-Failure header is true', async () => {
      const response = await request(server)
        .get('/supplierB/hotels')
        .set('x-simulate-failure', 'true');
        
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Simulated failure for Supplier B');
    });
  });
});
