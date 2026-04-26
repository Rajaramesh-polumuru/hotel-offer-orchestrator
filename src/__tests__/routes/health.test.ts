import request from 'supertest';
import { createTestApp } from '../../test-utils/app';
import { redisService } from '../../redis';

// Mock dependencies
jest.mock('../../redis', () => ({
  redisService: {
    isHealthy: jest.fn(),
  },
}));

import { Server } from 'http';

const originalFetch = global.fetch;

describe('Health Route Integration', () => {
  const app = createTestApp();
  let server: Server;
  let testUrl: string;

  beforeAll((done) => {
    server = app.listen(31003, '127.0.0.1', done);
  });

  afterAll((done) => {
    global.fetch = originalFetch;
    server.close(done);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns healthy status when all services are up', async () => {
    (redisService.isHealthy as jest.Mock).mockResolvedValue(true);
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;

    const response = await request(server).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body.redis.status).toBe('connected');
    expect(response.body.suppliers.supplierA.status).toBe('up');
    expect(response.body.suppliers.supplierB.status).toBe('up');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body.suppliers.supplierA).toHaveProperty('responseTimeMs');
  });

  it('returns degraded status when Redis is down', async () => {
    (redisService.isHealthy as jest.Mock).mockResolvedValue(false);
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;

    const response = await request(server).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('degraded');
    expect(response.body.redis.status).toBe('disconnected');
    expect(response.body.suppliers.supplierA.status).toBe('up');
  });

  it('returns degraded status when a supplier is down', async () => {
    (redisService.isHealthy as jest.Mock).mockResolvedValue(true);
    
    // supplierA down, supplierB up
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('supplierA')) {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({ ok: true });
    }) as any;

    const response = await request(server).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('degraded');
    expect(response.body.suppliers.supplierA.status).toBe('down');
    expect(response.body.suppliers.supplierB.status).toBe('up');
  });

  it('returns unhealthy status (503) when all services are down', async () => {
    (redisService.isHealthy as jest.Mock).mockResolvedValue(false);
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error')) as any;

    const response = await request(server).get('/health');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('unhealthy');
    expect(response.body.redis.status).toBe('disconnected');
    expect(response.body.suppliers.supplierA.status).toBe('down');
    expect(response.body.suppliers.supplierB.status).toBe('down');
  });

  it('handles non-200 supplier responses as down', async () => {
    (redisService.isHealthy as jest.Mock).mockResolvedValue(true);
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as any;

    const response = await request(server).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('degraded');
    expect(response.body.suppliers.supplierA.status).toBe('down');
  });
});
