import { Router, Request, Response } from 'express';
import { HealthStatus } from '../types';
import { redisService } from '../redis';
import { config } from '../config';

export const healthRouter = Router();

healthRouter.get('/health', async (req: Request, res: Response) => {
  const status: HealthStatus = {
    status: 'healthy',
    suppliers: {},
    redis: { status: 'down' },
    timestamp: new Date().toISOString(),
  };

  // 1. Check Redis
  const redisHealthy = await redisService.isHealthy();
  status.redis.status = redisHealthy ? 'connected' : 'disconnected';

  // 2. Check Suppliers
  const checkSupplier = async (name: string, path: string) => {
    const url = `${config.supplierBaseUrl}${path}?city=test`;
    const start = Date.now();
    try {
      const response = await fetch(url);
      const duration = Date.now() - start;
      status.suppliers[name] = {
        status: response.ok ? 'up' : 'down',
        responseTimeMs: duration,
      };
      return response.ok;
    } catch {
      status.suppliers[name] = {
        status: 'down',
        responseTimeMs: Date.now() - start,
      };
      return false;
    }
  };

  const [aOk, bOk] = await Promise.all([
    checkSupplier('supplierA', '/supplierA/hotels'),
    checkSupplier('supplierB', '/supplierB/hotels'),
  ]);

  // Determine overall status
  const servicesUp = [redisHealthy, aOk, bOk].filter(Boolean).length;
  if (servicesUp === 3) {
    status.status = 'healthy';
  } else if (servicesUp > 0) {
    status.status = 'degraded';
    res.status(200); // Usually degraded still returns 200 to load balancers, but you could use 503
  } else {
    status.status = 'unhealthy';
    res.status(503);
  }

  res.json(status);
});
