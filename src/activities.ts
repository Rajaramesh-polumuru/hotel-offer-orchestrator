import { RawHotel, HotelResponse } from './types';
import { redisService } from './redis';
import { logger } from './logger';

import { config } from './config';

// Explicit mapping of supplier name to API path — prevents unknown suppliers
// from silently routing to Supplier B (fix #5)
const supplierPaths: Record<string, string> = {
  'Supplier A': '/supplierA/hotels',
  'Supplier B': '/supplierB/hotels',
};

export async function fetchSupplierHotels(
  supplierName: string,
  city: string
): Promise<RawHotel[]> {
  const path = supplierPaths[supplierName];
  if (!path) {
    logger.warn({ supplierName }, 'Unknown supplier name. Returning empty array.');
    return [];
  }

  try {
    const url = `${config.supplierBaseUrl}${path}?city=${encodeURIComponent(city)}`;
    
    // Use AbortController for strict timeout instead of relying entirely on Temporal
    // This allows us to catch the error cleanly and return []
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const startTime = Date.now();
    try {
      const response = await fetch(url, { signal: controller.signal });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: RawHotel[] = await response.json();
      logger.info({ supplierName, city, count: data.length, durationMs: Date.now() - startTime }, 'Successfully fetched supplier data');

      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    // Graceful degradation: Log the error and return empty array
    // This ensures one failed supplier doesn't break the whole workflow
    logger.warn({ supplierName, city, err: error }, 'Supplier fetch failed or timed out. Returning empty array.');
    return [];
  }
}

export async function cacheResults(city: string, hotels: HotelResponse[]): Promise<void> {
  await redisService.cacheHotels(city, hotels);
}
