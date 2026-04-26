import request from 'supertest';

// Use the API URL from environment, or default to localhost for local testing
const API_URL = process.env.SUPPLIER_BASE_URL || 'http://localhost:3000';

describe('End-to-End Flow', () => {
  // Give Temporal some time to initialize if we just brought the stack up
  beforeAll(async () => {
    // Wait for health check to pass (all services up)
    let isHealthy = false;
    let attempts = 0;
    while (!isHealthy && attempts < 15) {
      try {
        const res = await request(API_URL).get('/health');
        if (res.status === 200 && res.body.status === 'healthy') {
          isHealthy = true;
        }
      } catch (e) {
        // Ignore
      }
      if (!isHealthy) {
        await new Promise(r => setTimeout(r, 2000));
        attempts++;
      }
    }
    
    if (!isHealthy) {
      console.warn('Warning: Services did not become healthy within timeout. Tests may fail.');
    }
  }, 35000);

  it('GET /health returns healthy status', async () => {
    const response = await request(API_URL).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
  });

  it('executes full workflow for delhi and returns deduplicated results', async () => {
    // This executes the Temporal workflow, fetches from both mock suppliers, and caches
    const response = await request(API_URL).get('/api/hotels?city=delhi');
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    
    // Expecting 5 unique hotels for Delhi (based on mock data)
    expect(response.body.length).toBe(5);
    
    // Check specific deduplication logic
    const holtin = response.body.find((h: any) => h.name === 'Holtin');
    expect(holtin.price).toBe(5340); // B's price won
    expect(holtin.supplier).toBe('Supplier B');
  });

  it('filters results by price range via Redis', async () => {
    // Prerequisite: Workflow must have run for 'delhi' recently to populate cache.
    // The previous test ensures this.
    const response = await request(API_URL).get('/api/hotels?city=delhi&minPrice=5000&maxPrice=6000');
    
    expect(response.status).toBe(200);
    const hotels = response.body;
    expect(hotels.length).toBeGreaterThan(0);
    
    hotels.forEach((hotel: any) => {
      expect(hotel.price).toBeGreaterThanOrEqual(5000);
      expect(hotel.price).toBeLessThanOrEqual(6000);
    });
  });

  it('handles concurrent requests for the same city without workflow ID collision', async () => {
    // Launch two requests simultaneously
    const [res1, res2] = await Promise.all([
      request(API_URL).get('/api/hotels?city=mumbai'),
      request(API_URL).get('/api/hotels?city=mumbai')
    ]);

    // Both should succeed (if there was a workflow ID collision, one would fail)
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    
    // Both should return the same valid data
    expect(res1.body.length).toBeGreaterThan(0);
    expect(res1.body).toEqual(res2.body);
  });

  it('returns empty array for city with no data', async () => {
    const response = await request(API_URL).get('/api/hotels?city=london');
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
});
