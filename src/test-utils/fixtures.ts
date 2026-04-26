import { RawHotel, HotelResponse } from '../types';

// Factory for creating test RawHotel objects with sensible defaults
export function makeHotel(overrides: Partial<RawHotel> = {}): RawHotel {
  return {
    hotelId: 'H1',
    name: 'Test Hotel',
    price: 5000,
    city: 'delhi',
    commissionPct: 10,
    ...overrides,
  };
}

// Factory for creating test HotelResponse objects with sensible defaults
export function makeHotelResponse(overrides: Partial<HotelResponse> = {}): HotelResponse {
  return {
    name: 'Test Hotel',
    price: 5000,
    supplier: 'Supplier A',
    commissionPct: 10,
    ...overrides,
  };
}

// Pre-built datasets matching src/data/suppliers.ts for Delhi
export const delhiSupplierA: RawHotel[] = [
  { hotelId: 'A1', name: 'Holtin', price: 6000, city: 'delhi', commissionPct: 10 },
  { hotelId: 'A2', name: 'Radison', price: 5900, city: 'delhi', commissionPct: 13 },
  { hotelId: 'A3', name: 'Taj', price: 12000, city: 'delhi', commissionPct: 15 },
  { hotelId: 'A6', name: 'Leela', price: 15000, city: 'delhi', commissionPct: 18 },
];

export const delhiSupplierB: RawHotel[] = [
  { hotelId: 'B1', name: 'Holtin', price: 5340, city: 'delhi', commissionPct: 20 },
  { hotelId: 'B2', name: 'Radison', price: 6100, city: 'delhi', commissionPct: 15 },
  { hotelId: 'B3', name: 'Taj', price: 12000, city: 'delhi', commissionPct: 20 },
  { hotelId: 'B6', name: 'Novotel', price: 6500, city: 'delhi', commissionPct: 12 },
];
