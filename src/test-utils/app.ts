import express from 'express';
import { supplierRouter } from '../routes/suppliers';
import { healthRouter } from '../routes/health';
import { hotelsRouter } from '../routes/hotels';

/**
 * Creates an Express app with all routes mounted but WITHOUT starting a server.
 * This is used by supertest for integration testing.
 */
export function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(supplierRouter);
  app.use(hotelsRouter);
  app.use(healthRouter);

  // Global error handler (mirrors index.ts)
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: 'Internal Server Error' });
  });

  return app;
}
