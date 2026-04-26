import express from 'express';
import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';
import { config } from './config';
import { logger } from './logger';
import { supplierRouter } from './routes/suppliers';
import { hotelsRouter } from './routes/hotels';
import { healthRouter } from './routes/health';
import { redisService } from './redis';

const app = express();

// Middleware: Structured logging with correlation IDs
app.use(pinoHttp({
  logger,
  genReqId: (req) => req.headers['x-correlation-id'] || randomUUID(),
}));

app.use(express.json());

// Routes
app.use(supplierRouter); // Mock suppliers
app.use(hotelsRouter);   // Main API
app.use(healthRouter);   // Health check

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled exception');
  res.status(500).json({ error: 'Internal Server Error' });
});

const server = app.listen(config.port, () => {
  logger.info(`Server listening on port ${config.port}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully.');
  server.close(() => {
    logger.info('HTTP server closed.');
  });
  redisService.getClient().quit();
});
