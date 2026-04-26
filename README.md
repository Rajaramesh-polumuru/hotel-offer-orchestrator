# Hotel Offer Orchestrator

A robust Node.js/TypeScript backend service that aggregates hotel offers from multiple mock suppliers in parallel, deduplicates them using best-price logic, and provides price-range filtering via Redis.

## Architecture

```
Client ──► Express API ──► Temporal Workflow ──► Worker
                                                  ├── fetchSupplierHotels (Supplier A)  ──► Mock /supplierA/hotels
                                                  ├── fetchSupplierHotels (Supplier B)  ──► Mock /supplierB/hotels
                                                  └── cacheResults ──► Redis (Sorted Set + Hash)
```

**Services (Docker Compose):**

| Service    | Image / Build           | Port  | Purpose                              |
|------------|-------------------------|-------|--------------------------------------|
| `temporal` | `temporalio/admin-tools` | 7233, 8233 | Workflow engine (dev server)    |
| `redis`    | `redis:7-alpine`        | 6379  | Caching & price-range queries        |
| `api`      | Local build             | 3000  | Express REST API + mock suppliers    |
| `worker`   | Local build             | —     | Temporal worker (executes workflows) |

## Features

- **Temporal.io Orchestration** — Parallel supplier fetches with built-in retry (3 attempts, exponential backoff) and timeout handling.
- **Smart Deduplication** — When the same hotel appears from both suppliers, the best offer wins: lowest price first, then highest commission as tiebreaker.
- **Redis Price Filtering** — Sorted Sets for O(log N) price-range lookups, paired with Hashes for full hotel data retrieval.
- **Graceful Degradation** — If a supplier fails or times out (5s), the workflow returns results from the other supplier instead of failing entirely.
- **Structured Logging** — Pino with ISO timestamps, request-level correlation IDs via `X-Correlation-Id` header.
- **Health Check** — `/health` endpoint probes Redis connectivity and both supplier endpoints with response times.
- **Dockerized** — Single `docker compose up --build` to run the entire stack.

## Quick Start

### Prerequisites

- Docker & Docker Compose v2+

### Run

```bash
docker compose up --build
```

Wait for all services to become healthy. The first run takes a moment as Temporal initializes its schema.

### Verify

```bash
# Get all Delhi hotels (deduplicated best offers)
curl http://localhost:3000/api/hotels?city=delhi

# Filter by price range
curl "http://localhost:3000/api/hotels?city=delhi&minPrice=4000&maxPrice=6000"

# Health check
curl http://localhost:3000/health
```

## API Reference

### `GET /api/hotels`

Fetches hotel offers from all suppliers via a Temporal workflow, deduplicates, caches to Redis, and returns the best offers.

| Query Param | Required | Description                                     |
|-------------|----------|-------------------------------------------------|
| `city`      | Yes      | City to search (e.g. `delhi`, `mumbai`, `bangalore`) |
| `minPrice`  | No       | Minimum price filter (requires `maxPrice` too)  |
| `maxPrice`  | No       | Maximum price filter (requires `minPrice` too)  |

**Response** — `200 OK`
```json
[
  { "name": "Holtin", "price": 5340, "supplier": "Supplier B", "commissionPct": 20 },
  { "name": "Radison", "price": 5900, "supplier": "Supplier A", "commissionPct": 13 },
  { "name": "Taj", "price": 12000, "supplier": "Supplier B", "commissionPct": 20 }
]
```

### `GET /health`

Returns system health status for Redis and both supplier endpoints.

**Response** — `200 OK` (healthy/degraded) or `503` (unhealthy)
```json
{
  "status": "healthy",
  "suppliers": {
    "supplierA": { "status": "up", "responseTimeMs": 12 },
    "supplierB": { "status": "up", "responseTimeMs": 8 }
  },
  "redis": { "status": "connected" },
  "timestamp": "2026-04-26T10:00:00.000Z"
}
```

### Mock Supplier Endpoints

These are built into the API server and serve static test data:

| Endpoint                            | Description               |
|-------------------------------------|---------------------------|
| `GET /supplierA/hotels?city=delhi`  | Returns Supplier A hotels |
| `GET /supplierB/hotels?city=delhi`  | Returns Supplier B hotels |

## Deduplication Logic

When the same hotel (matched by name, case-insensitive) appears from both suppliers:

1. **Lower price wins**
2. If prices are equal → **higher commission wins** (better for business)

### Example — Delhi Hotels

| Hotel    | Supplier A          | Supplier B          | Winner              | Reason                              |
|----------|---------------------|---------------------|---------------------|-------------------------------------|
| Holtin   | ₹6,000 / 10%       | ₹5,340 / 20%       | **Supplier B**      | Lower price                         |
| Radison  | ₹5,900 / 13%       | ₹6,100 / 15%       | **Supplier A**      | Lower price                         |
| Taj      | ₹12,000 / 15%      | ₹12,000 / 20%      | **Supplier B**      | Same price, higher commission       |
| Leela    | ₹15,000 / 18%      | —                   | **Supplier A**      | Only in A                           |
| Novotel  | —                   | ₹6,500 / 12%       | **Supplier B**      | Only in B                           |

## Testing

The project ships with a Jest + ts-jest unit/integration test suite. Redis is faked with `ioredis-mock`, the Temporal client is dependency-injected via `_setTemporalClientForTest`, and HTTP routes are exercised through `supertest` against an Express app built with `createTestApp()` (no real listener required for routing tests; route suites that bind use `127.0.0.1` to avoid sandbox EPERM).

```bash
npm test               # run all unit + integration suites
npm run test:coverage  # run with coverage (thresholds: 90/85/90/90)
npm run test:watch     # watch mode
```

| Suite                          | Focus                                                              |
|--------------------------------|--------------------------------------------------------------------|
| `activities.test.ts`           | Supplier fetch URLs, timeouts, error → empty-array degradation     |
| `deduplication.test.ts`        | Pure dedupe — lowest price, commission tiebreaker                  |
| `contract.test.ts`             | Mock supplier response shape matches `RawHotel`                    |
| `redis.test.ts`                | `cacheHotels` / `getFilteredHotels` against `ioredis-mock`         |
| `routes/hotels.test.ts`        | Query validation (400s), workflow happy path, 500s on Temporal err |
| `routes/health.test.ts`        | Healthy / degraded / unhealthy status combinations                 |
| `routes/suppliers.test.ts`     | Mock supplier filtering and `X-Simulate-Failure` toggle            |

**E2E tests** (`src/__tests__/e2e/`) are excluded from the default run and require the full Docker stack to be up. To run them against the live stack:

```bash
docker compose up -d --build
docker compose -f docker-compose.test.yml run --rm test-runner
```

## Testing with Postman

A Postman collection is included at `postman/collection.json`. Import it into Postman to test:

| # | Test Case                        | What it verifies                                         |
|---|----------------------------------|----------------------------------------------------------|
| 1 | Get Hotels — Delhi               | Parallel fetch, deduplication, best-price selection       |
| 2 | Get Hotels — Price Filtered      | Redis sorted set range query (₹4,000–₹6,000)            |
| 3 | Get Hotels — No Results (London) | Empty array returned for cities with no data             |
| 4 | Health Check                     | All services connectivity & response times               |
| 5 | Simulate Supplier Down           | Graceful degradation via `X-Simulate-Failure` header     |

## Project Structure

```
├── docker-compose.yml          # 4-service stack (Temporal, Redis, API, Worker)
├── docker-compose.test.yml     # Optional E2E test runner against the live stack
├── Dockerfile                  # Multi-stage build (builder → production)
├── jest.config.ts              # Jest + ts-jest config (coverage thresholds: 90/85/90/90)
├── package.json
├── tsconfig.json
├── postman/
│   └── collection.json         # Postman test collection
└── src/
    ├── index.ts                # Express server entrypoint
    ├── worker.ts               # Temporal worker entrypoint
    ├── workflows.ts            # Temporal workflow (sandbox-safe, no Node.js globals)
    ├── activities.ts           # Temporal activities (fetch suppliers, cache to Redis)
    ├── config.ts               # Environment variable configuration
    ├── logger.ts               # Pino logger setup
    ├── redis.ts                # Redis service (sorted sets + hashes)
    ├── types.ts                # TypeScript interfaces
    ├── data/
    │   └── suppliers.ts        # Mock supplier hotel data
    ├── routes/
    │   ├── hotels.ts           # GET /api/hotels (Temporal client → workflow)
    │   ├── suppliers.ts        # Mock supplier endpoints
    │   └── health.ts           # GET /health
    ├── test-utils/
    │   ├── app.ts              # createTestApp() — Express app without listen()
    │   └── fixtures.ts         # makeHotel() / makeHotelResponse() builders
    └── __tests__/
        ├── activities.test.ts        # fetchSupplierHotels + cacheResults
        ├── deduplication.test.ts     # Pure dedupe rules (price → commission)
        ├── contract.test.ts          # Supplier response schema contract
        ├── redis.test.ts             # RedisService against ioredis-mock
        ├── routes/
        │   ├── hotels.test.ts        # GET /api/hotels (validation, happy, errors)
        │   ├── health.test.ts        # GET /health (healthy/degraded/unhealthy)
        │   └── suppliers.test.ts     # Mock supplier route filtering
        └── e2e/
            └── full-flow.test.ts     # Live-stack E2E (excluded from default run)
```

## Environment Variables

| Variable             | Default                  | Description                        |
|----------------------|--------------------------|------------------------------------|
| `PORT`               | `3000`                   | API server port                    |
| `REDIS_URL`          | `redis://localhost:6379`  | Redis connection URL              |
| `TEMPORAL_ADDRESS`   | `localhost:7233`          | Temporal server gRPC address      |
| `SUPPLIER_BASE_URL`  | `http://localhost:3000`   | Base URL for supplier endpoints   |
| `LOG_LEVEL`          | `info`                   | Pino log level                    |
| `CACHE_TTL_SECONDS`  | `300`                    | Redis cache TTL (5 min default)   |

## Local Development (Without Docker)

```bash
# 1. Start Temporal dev server
temporal server start-dev

# 2. Start Redis
docker run -d -p 6379:6379 redis:7-alpine

# 3. Install dependencies
npm install

# 4. Start API server (terminal 1)
npm run dev:api

# 5. Start Worker (terminal 2)
npm run dev:worker
```

## Tech Stack

- **Runtime:** Node.js 20
- **Language:** TypeScript (ES2022, CommonJS)
- **Orchestration:** Temporal.io
- **Caching:** Redis 7 (via ioredis)
- **API Framework:** Express 5
- **Logging:** Pino + pino-http
- **Containerization:** Docker, multi-stage builds
- **Testing:** Jest + ts-jest, supertest, ioredis-mock
