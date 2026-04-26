import { makeHotel } from '../test-utils/fixtures';

// Mock redis and logger to avoid real connections
jest.mock('../redis', () => ({
  redisService: {
    cacheHotels: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock('../config', () => ({
  config: {
    supplierBaseUrl: 'http://mock-api:3000',
  },
}));

import { fetchSupplierHotels, cacheResults } from '../activities';
import { redisService } from '../redis';

// Store original fetch
const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

describe('fetchSupplierHotels', () => {
  it('fetches from Supplier A with correct URL', async () => {
    const mockData = [makeHotel({ name: 'Holtin' })];
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    }) as any;

    const result = await fetchSupplierHotels('Supplier A', 'delhi');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://mock-api:3000/supplierA/hotels?city=delhi',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(result).toEqual(mockData);
  });

  it('fetches from Supplier B with correct URL', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    }) as any;

    await fetchSupplierHotels('Supplier B', 'mumbai');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://mock-api:3000/supplierB/hotels?city=mumbai',
      expect.any(Object)
    );
  });

  it('encodes special characters in city name', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    }) as any;

    await fetchSupplierHotels('Supplier A', 'new york');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('city=new%20york'),
      expect.any(Object)
    );
  });

  it('returns empty array on HTTP 500', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }) as any;

    const result = await fetchSupplierHotels('Supplier A', 'delhi');
    expect(result).toEqual([]);
  });

  it('returns empty array on HTTP 404', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }) as any;

    const result = await fetchSupplierHotels('Supplier A', 'delhi');
    expect(result).toEqual([]);
  });

  it('returns empty array on network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as any;

    const result = await fetchSupplierHotels('Supplier A', 'delhi');
    expect(result).toEqual([]);
  });

  it('returns empty array when response is invalid JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    }) as any;

    const result = await fetchSupplierHotels('Supplier A', 'delhi');
    expect(result).toEqual([]);
  });

  it('returns empty array for supplier with empty result', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    }) as any;

    const result = await fetchSupplierHotels('Supplier A', 'london');
    expect(result).toEqual([]);
  });

  it('returns empty array and warns for unknown supplier name', async () => {
    const { logger } = require('../logger');
    global.fetch = jest.fn() as any;
    const result = await fetchSupplierHotels('Supplier C', 'delhi');

    expect(result).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      { supplierName: 'Supplier C' },
      'Unknown supplier name. Returning empty array.'
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('handles AbortController timeout', async () => {
    global.fetch = jest.fn().mockImplementation(() => {
      return new Promise((_, reject) => {
        setTimeout(() => reject(new DOMException('Aborted', 'AbortError')), 10);
      });
    }) as any;

    const result = await fetchSupplierHotels('Supplier A', 'delhi');
    expect(result).toEqual([]);
  });
});

describe('cacheResults', () => {
  it('delegates to redisService.cacheHotels', async () => {
    const hotels = [{ name: 'Taj', price: 12000, supplier: 'A', commissionPct: 15 }];
    await cacheResults('delhi', hotels);

    expect(redisService.cacheHotels).toHaveBeenCalledWith('delhi', hotels);
  });
});
