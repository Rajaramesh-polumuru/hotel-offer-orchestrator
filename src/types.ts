export interface RawHotel {
  hotelId: string;
  name: string;
  price: number;
  city: string;
  commissionPct: number;
}

export interface HotelResponse {
  name: string;
  price: number;
  supplier: string;
  commissionPct: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  suppliers: Record<string, { status: string; responseTimeMs: number }>;
  redis: { status: string };
  timestamp: string;
}
