import { RawHotel, HotelResponse } from '../types';
import { deduplicateAndSelectBest } from '../workflows';

describe('Workflow Type Contract', () => {
  it('RawHotel from types.ts is accepted by deduplicateAndSelectBest', () => {
    const hotel: RawHotel = {
      hotelId: 'X1',
      name: 'Contract Hotel',
      price: 5000,
      city: 'test',
      commissionPct: 10,
    };

    const result = deduplicateAndSelectBest([hotel], [], 'A', 'B');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Contract Hotel');
    expect(result[0].price).toBe(5000);
    expect(result[0].commissionPct).toBe(10);
  });

  it('HotelResponse output matches canonical interface shape', () => {
    const hotel: RawHotel = {
      hotelId: 'X1',
      name: 'Shape Test',
      price: 7000,
      city: 'test',
      commissionPct: 15,
    };

    const result = deduplicateAndSelectBest([hotel], [], 'Supplier A', 'B');
    const output = result[0];

    const expected: HotelResponse = {
      name: expect.any(String),
      price: expect.any(Number),
      supplier: expect.any(String),
      commissionPct: expect.any(Number),
    };

    expect(output).toEqual(expected);

    const outputKeys = Object.keys(output).sort();
    const expectedKeys = ['commissionPct', 'name', 'price', 'supplier'];
    expect(outputKeys).toEqual(expectedKeys);
  });

  it('canonical HotelResponse has exactly the fields workflow produces', () => {
    const canonical: HotelResponse = {
      name: 'x',
      price: 1,
      supplier: 'x',
      commissionPct: 1,
    };

    const canonicalKeys = Object.keys(canonical).sort();
    const expectedKeys = ['commissionPct', 'name', 'price', 'supplier'];
    expect(canonicalKeys).toEqual(expectedKeys);
  });
});
