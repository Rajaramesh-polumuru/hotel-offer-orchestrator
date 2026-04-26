# Hotel Offer Orchestrator

A robust Node.js/TypeScript backend service that aggregates hotel offers from multiple mock suppliers, deduplicates them, and provides price-range filtering using Redis.

## Features
- **Temporal.io Orchestration**: Orchestrates parallel supplier API calls and ensures deterministic deduplication.
- **Redis Caching**: Uses a combination of Redis Sorted Sets and Hashes for atomic, high-performance price-range filtering.
- **Graceful Degradation**: If one supplier fails, the workflow gracefully degrades and returns the other supplier's data.
- **Dockerized**: Easy setup with Docker Compose.
- **Structured Logging**: Request tracing with Correlation IDs using Pino.

## Quick Start (Docker)

1. Make sure Docker is installed and running.
2. Run the following command:
```bash
docker compose up --build
```
3. Wait for all services to become healthy. The first run takes a moment as Temporal initializes its database schema.

## Endpoints

- **Get Hotels**: `GET http://localhost:3000/api/hotels?city=delhi`
- **Filter by Price**: `GET http://localhost:3000/api/hotels?city=delhi&minPrice=4000&maxPrice=6000`
- **Health Check**: `GET http://localhost:3000/health` (Checks Redis and both Suppliers)

## Testing with Postman
A Postman collection is included in `postman/collection.json` to verify all required scenarios (including simulating a supplier down).

## Local Development (Without Docker)
1. Start Temporal locally: `temporal server start-dev`
2. Start Redis locally: `docker run -d -p 6379:6379 redis:7-alpine`
3. Install dependencies: `npm install`
4. Start API server: `npm run dev:api`
5. Start Worker: `npm run dev:worker`
