import { RawHotel, HotelResponse } from './types';
import { redisService } from './redis';
import { logger } from './logger';

import { config } from './config';

export async function fetchSupplierHotels(
  supplierName: string,
  city: string
): Promise<RawHotel[]> {
  try {
    const url = `${config.supplierBaseUrl}/supplier${supplierName === 'Supplier A' ? 'A' : 'B'}/hotels?city=${encodeURIComponent(city)}`;
    
    // Use AbortController for strict timeout instead of relying entirely on Temporal
    // This allows us to catch the error cleanly and return []
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const startTime = Date.now();
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: RawHotel[] = await response.json();
    logger.info({ supplierName, city, count: data.length, durationMs: Date.now() - startTime }, 'Successfully fetched supplier data');
    
    // Add supplier name manually since the mock API doesn't include it but we need it for HotelResponse
    return data;
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
