export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  temporalAddress: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  supplierBaseUrl: process.env.SUPPLIER_BASE_URL || 'http://localhost:3000',
  logLevel: process.env.LOG_LEVEL || 'info',
  cacheTtlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '300', 10), // 5 minutes default
};
