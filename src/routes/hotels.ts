import { Router, Request, Response } from 'express';
import { WorkflowClient, Connection } from '@temporalio/client';
import { hotelOfferWorkflow } from '../workflows';
import { redisService } from '../redis';
import { logger } from '../logger';
import { config } from '../config';

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

hotelsRouter.get('/api/hotels', async (req: Request, res: Response) => {
  const city = req.query.city as string;
  const minPriceStr = req.query.minPrice as string;
  const maxPriceStr = req.query.maxPrice as string;

  if (!city) {
    return res.status(400).json({ error: 'city query parameter is required' });
  }

  try {
    const client = await getTemporalClient();
    
    // Create a unique deterministic ID for this request
    const workflowId = `hotel-offers-${city}-${Date.now()}`;
    
    logger.info({ city, workflowId }, 'Starting Temporal workflow');

    // Start and wait for the workflow to complete
    const bestOffers = await client.execute(hotelOfferWorkflow, {
      args: [city],
      workflowId: workflowId,
      taskQueue: 'hotel-offers',
    });

    logger.info({ city, count: bestOffers.length }, 'Workflow completed');

    // If price filters are provided, query Redis as per requirement
    if (minPriceStr && maxPriceStr) {
      const minPrice = parseInt(minPriceStr, 10);
      const maxPrice = parseInt(maxPriceStr, 10);

      if (isNaN(minPrice) || isNaN(maxPrice)) {
        return res.status(400).json({ error: 'minPrice and maxPrice must be valid numbers' });
      }

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
