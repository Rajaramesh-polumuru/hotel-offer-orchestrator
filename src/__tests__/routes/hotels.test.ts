import request from 'supertest';
import { createTestApp } from '../../test-utils/app';
import { _setTemporalClientForTest } from '../../routes/hotels';
import { redisService } from '../../redis';
import { makeHotelResponse } from '../../test-utils/fixtures';
import { Server } from 'http';

jest.mock('../../logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../redis', () => ({
  redisService: {
    getFilteredHotels: jest.fn(),
  },
}));

describe('Hotels Route Integration', () => {
  const app = createTestApp();
  const mockExecute = jest.fn();
  let server: Server;
  let testUrl: string;

  beforeAll((done) => {
    _setTemporalClientForTest({ execute: mockExecute } as any);
    server = app.listen(31002, '127.0.0.1', done);
  });

  afterAll((done) => {
    _setTemporalClientForTest(null);
    server.close(done);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Validation (400s)', () => {
    it('returns 400 when city is missing', async () => {
      const response = await request(server).get('/api/hotels');
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'city query parameter is required');
    });

    it('returns 400 when city is only whitespace', async () => {
      const response = await request(server).get('/api/hotels?city=   ');
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'city query parameter is required');
    });

    it('returns 400 when minPrice is provided without maxPrice', async () => {
      const response = await request(server).get('/api/hotels?city=delhi&minPrice=4000');
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Both minPrice and maxPrice are required');
    });

    it('returns 400 when maxPrice is provided without minPrice', async () => {
      const response = await request(server).get('/api/hotels?city=delhi&maxPrice=6000');
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Both minPrice and maxPrice are required');
    });

    it('returns 400 when minPrice > maxPrice', async () => {
      const response = await request(server).get('/api/hotels?city=delhi&minPrice=6000&maxPrice=4000');
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('minPrice must be less than or equal to maxPrice');
    });

    it('returns 400 when minPrice or maxPrice are negative', async () => {
      const response = await request(server).get('/api/hotels?city=delhi&minPrice=-100&maxPrice=5000');
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Price values must be non-negative');
    });

    it('returns 400 when minPrice or maxPrice are invalid numbers', async () => {
      const response = await request(server).get('/api/hotels?city=delhi&minPrice=abc&maxPrice=5000');
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('must be valid numbers');
    });
  });

  describe('Happy Path (200s)', () => {
    it('executes Temporal workflow and returns results when no price filter is provided', async () => {
      const mockOffers = [makeHotelResponse({ name: 'Hotel 1' })];
      mockExecute.mockResolvedValue(mockOffers);

      const response = await request(server).get('/api/hotels?city=delhi');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockOffers);
      expect(mockExecute).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
        args: ['delhi'],
        workflowId: expect.stringMatching(/^hotel-offers-delhi-\d+-[a-f0-9-]+$/),
        taskQueue: 'hotel-offers',
      }));
      expect(redisService.getFilteredHotels).not.toHaveBeenCalled();
    });

    it('queries Redis when valid price filters are provided', async () => {
      const workflowOffers = [makeHotelResponse({ name: 'Hotel 1' })];
      mockExecute.mockResolvedValue(workflowOffers);

      const filteredOffers = [makeHotelResponse({ name: 'Hotel 1', price: 4500 })];
      (redisService.getFilteredHotels as jest.Mock).mockResolvedValue(filteredOffers);

      const response = await request(server).get('/api/hotels?city=delhi&minPrice=4000&maxPrice=5000');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(filteredOffers);
      expect(mockExecute).toHaveBeenCalled();
      expect(redisService.getFilteredHotels).toHaveBeenCalledWith('delhi', 4000, 5000);
    });

    it('allows minPrice=0', async () => {
      mockExecute.mockResolvedValue([]);
      (redisService.getFilteredHotels as jest.Mock).mockResolvedValue([]);

      const response = await request(server).get('/api/hotels?city=delhi&minPrice=0&maxPrice=100');

      expect(response.status).toBe(200);
      expect(redisService.getFilteredHotels).toHaveBeenCalledWith('delhi', 0, 100);
    });
  });

  describe('Error Handling (500s)', () => {
    it('returns 500 when Temporal execution throws', async () => {
      mockExecute.mockRejectedValue(new Error('Temporal is down'));

      const response = await request(server).get('/api/hotels?city=delhi');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal server error while processing offers');
    });
  });
});
