import { Router, Request, Response } from 'express';
import { WorkflowClient, Connection } from '@temporalio/client';
import { hotelOfferWorkflow } from '../workflows';
import { redisService } from '../redis';
import { logger } from '../logger';
import { config } from '../config';
import { randomUUID } from 'crypto';

export const hotelsRouter = Router();

// Singleton Temporal client — avoids creating a new TCP connection per request
let temporalClient: WorkflowClient | null = null;

async function getTemporalClient(): Promise<WorkflowClient> {
  if (!temporalClient) {
    const connection = await Connection.connect({ address: config.temporalAddress });
    temporalClient = new WorkflowClient({ connection });
    logger.info({ address: config.temporalAddress }, 'Temporal client connection established');
  }
  return temporalClient;
}

// Exported for testing — allows injecting a mock client
export function _setTemporalClientForTest(client: WorkflowClient | null) {
  temporalClient = client;
}

hotelsRouter.get('/api/hotels', async (req: Request, res: Response) => {
  const city = (req.query.city as string)?.trim();
  const minPriceStr = req.query.minPrice as string | undefined;
  const maxPriceStr = req.query.maxPrice as string | undefined;

  // Validate city
  if (!city) {
    return res.status(400).json({ error: 'city query parameter is required' });
  }

  // Validate price filter: both or neither
  if ((minPriceStr && !maxPriceStr) || (!minPriceStr && maxPriceStr)) {
    return res.status(400).json({ error: 'Both minPrice and maxPrice are required for filtering' });
  }

  // Validate price values up-front (before kicking off a workflow)
  let minPrice: number | undefined;
  let maxPrice: number | undefined;
  if (minPriceStr && maxPriceStr) {
    minPrice = parseInt(minPriceStr, 10);
    maxPrice = parseInt(maxPriceStr, 10);

    if (isNaN(minPrice) || isNaN(maxPrice)) {
      return res.status(400).json({ error: 'minPrice and maxPrice must be valid numbers' });
    }
    if (minPrice < 0 || maxPrice < 0) {
      return res.status(400).json({ error: 'Price values must be non-negative' });
    }
    if (minPrice > maxPrice) {
      return res.status(400).json({ error: 'minPrice must be less than or equal to maxPrice' });
    }
  }

  try {
    const client = await getTemporalClient();
    
    // Append UUID to prevent workflow ID collision under concurrent requests
    const workflowId = `hotel-offers-${city}-${Date.now()}-${randomUUID().slice(0, 8)}`;
    
    logger.info({ city, workflowId }, 'Starting Temporal workflow');

    // Start and wait for the workflow to complete
    const bestOffers = await client.execute(hotelOfferWorkflow, {
      args: [city],
      workflowId: workflowId,
      taskQueue: 'hotel-offers',
    });

    logger.info({ city, count: bestOffers.length }, 'Workflow completed');

    // If price filters are provided, query Redis
    if (minPrice !== undefined && maxPrice !== undefined) {
      logger.info({ city, minPrice, maxPrice }, 'Filtering results via Redis');
      const filteredOffers = await redisService.getFilteredHotels(city, minPrice, maxPrice);
      return res.json(filteredOffers);
    }

    // No filters, return full deduplicated list
    res.json(bestOffers);

  } catch (error) {
    logger.error({ err: error, city }, 'Error processing hotels request');
    res.status(500).json({ error: 'Internal server error while processing offers' });
  }
});
