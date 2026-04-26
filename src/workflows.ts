import { proxyActivities } from '@temporalio/workflow';

// Types are inlined here to avoid any transitive imports into the workflow sandbox.
// Temporal workflows run in a sandboxed V8 isolate where Node.js globals like `process`
// are not available. Importing from './activities' (even as `type`) can cause the
// TypeScript compiler (CommonJS mode) to emit a require() that pulls in config.ts,
// which uses process.env — crashing the sandbox with "process is not defined".

interface RawHotel {
  hotelId: string;
  name: string;
  price: number;
  city: string;
  commissionPct: number;
}

interface HotelResponse {
  name: string;
  price: number;
  supplier: string;
  commissionPct: number;
}

// Activity interface — mirrors the exports from activities.ts
interface Activities {
  fetchSupplierHotels(supplierName: string, city: string): Promise<RawHotel[]>;
  cacheResults(city: string, hotels: HotelResponse[]): Promise<void>;
}

const acts = proxyActivities<Activities>({
  startToCloseTimeout: '10s',
  scheduleToCloseTimeout: '30s',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

// Pure deterministic function for deduplication
export function deduplicateAndSelectBest(
  hotelsA: RawHotel[],
  hotelsB: RawHotel[],
  supplierAName: string,
  supplierBName: string
): HotelResponse[] {
  const hotelMap = new Map<string, HotelResponse>();

  const processList = (list: RawHotel[], supplier: string) => {
    for (const hotel of list) {
      const key = hotel.name.toLowerCase();
      const mappedHotel: HotelResponse = {
        name: hotel.name,
        price: hotel.price,
        supplier: supplier,
        commissionPct: hotel.commissionPct,
      };

      if (!hotelMap.has(key)) {
        hotelMap.set(key, mappedHotel);
      } else {
        const existing = hotelMap.get(key)!;
        // Rules for selecting best offer:
        // 1. Lower price wins
        // 2. If price is equal, higher commission wins (better for our business)
        if (
          mappedHotel.price < existing.price ||
          (mappedHotel.price === existing.price && mappedHotel.commissionPct > existing.commissionPct)
        ) {
          hotelMap.set(key, mappedHotel);
        }
      }
    }
  };

  processList(hotelsA, supplierAName);
  processList(hotelsB, supplierBName);

  return Array.from(hotelMap.values());
}

export async function hotelOfferWorkflow(city: string): Promise<HotelResponse[]> {
  // 1. Parallel fetch
  const [hotelsA, hotelsB] = await Promise.all([
    acts.fetchSupplierHotels('Supplier A', city),
    acts.fetchSupplierHotels('Supplier B', city),
  ]);

  // 2. Deterministic Deduplication
  const bestOffers = deduplicateAndSelectBest(hotelsA, hotelsB, 'Supplier A', 'Supplier B');

  // 3. Cache to Redis
  await acts.cacheResults(city, bestOffers);

  return bestOffers;
}
