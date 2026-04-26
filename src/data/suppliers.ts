import { RawHotel } from '../types';

export const supplierAData: RawHotel[] = [
  { hotelId: 'A1', name: 'Holtin', price: 6000, city: 'delhi', commissionPct: 10 },
  { hotelId: 'A2', name: 'Radison', price: 5900, city: 'delhi', commissionPct: 13 },
  { hotelId: 'A3', name: 'Taj', price: 12000, city: 'delhi', commissionPct: 15 },
  { hotelId: 'A4', name: 'Marriott', price: 8000, city: 'mumbai', commissionPct: 12 },
  { hotelId: 'A5', name: 'Ibis', price: 4000, city: 'bangalore', commissionPct: 8 },
  // Unique to A
  { hotelId: 'A6', name: 'Leela', price: 15000, city: 'delhi', commissionPct: 18 },
];

export const supplierBData: RawHotel[] = [
  { hotelId: 'B1', name: 'Holtin', price: 5340, city: 'delhi', commissionPct: 20 }, // Better price & commission than A
  { hotelId: 'B2', name: 'Radison', price: 6100, city: 'delhi', commissionPct: 15 }, // Worse price than A
  { hotelId: 'B3', name: 'Taj', price: 12000, city: 'delhi', commissionPct: 20 }, // Same price, better commission than A
  { hotelId: 'B4', name: 'Marriott', price: 7800, city: 'mumbai', commissionPct: 10 }, // Better price than A
  { hotelId: 'B5', name: 'Ibis', price: 4200, city: 'bangalore', commissionPct: 9 }, // Worse price than A
  // Unique to B
  { hotelId: 'B6', name: 'Novotel', price: 6500, city: 'delhi', commissionPct: 12 },
];
