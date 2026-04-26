import { deduplicateAndSelectBest } from '../workflows';
import { makeHotel, delhiSupplierA, delhiSupplierB } from '../test-utils/fixtures';

describe('deduplicateAndSelectBest', () => {
  // ─── Happy Path ────────────────────────────────────────────────

  it('selects lower price when hotel appears in both suppliers', () => {
    const hotelsA = [makeHotel({ name: 'Holtin', price: 6000, commissionPct: 10 })];
    const hotelsB = [makeHotel({ name: 'Holtin', price: 5340, commissionPct: 20 })];

    const result = deduplicateAndSelectBest(hotelsA, hotelsB, 'A', 'B');

    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(5340);
    expect(result[0].supplier).toBe('B');
  });

  it('selects higher commission when prices are equal', () => {
    const hotelsA = [makeHotel({ name: 'Taj', price: 12000, commissionPct: 15 })];
    const hotelsB = [makeHotel({ name: 'Taj', price: 12000, commissionPct: 20 })];

    const result = deduplicateAndSelectBest(hotelsA, hotelsB, 'A', 'B');

    expect(result).toHaveLength(1);
    expect(result[0].commissionPct).toBe(20);
    expect(result[0].supplier).toBe('B');
  });

  it('keeps first supplier entry when price and commission are equal', () => {
    const hotelsA = [makeHotel({ name: 'Same', price: 5000, commissionPct: 10 })];
    const hotelsB = [makeHotel({ name: 'Same', price: 5000, commissionPct: 10 })];

    const result = deduplicateAndSelectBest(hotelsA, hotelsB, 'A', 'B');

    expect(result).toHaveLength(1);
    expect(result[0].supplier).toBe('A');
  });

  it('passes through unique hotels from supplier A only', () => {
    const hotelsA = [makeHotel({ name: 'Leela', price: 15000 })];
    const hotelsB: ReturnType<typeof makeHotel>[] = [];

    const result = deduplicateAndSelectBest(hotelsA, hotelsB, 'A', 'B');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Leela');
    expect(result[0].supplier).toBe('A');
  });

  it('passes through unique hotels from supplier B only', () => {
    const hotelsA: ReturnType<typeof makeHotel>[] = [];
    const hotelsB = [makeHotel({ name: 'Novotel', price: 6500 })];

    const result = deduplicateAndSelectBest(hotelsA, hotelsB, 'A', 'B');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Novotel');
    expect(result[0].supplier).toBe('B');
  });

  it('correctly deduplicates full Delhi dataset', () => {
    const result = deduplicateAndSelectBest(delhiSupplierA, delhiSupplierB, 'Supplier A', 'Supplier B');

    // 4 from A + 4 from B, 3 overlap → 5 unique hotels
    expect(result).toHaveLength(5);

    const holtin = result.find(h => h.name === 'Holtin')!;
    expect(holtin.price).toBe(5340);
    expect(holtin.supplier).toBe('Supplier B');

    const radison = result.find(h => h.name === 'Radison')!;
    expect(radison.price).toBe(5900);
    expect(radison.supplier).toBe('Supplier A');

    const taj = result.find(h => h.name === 'Taj')!;
    expect(taj.price).toBe(12000);
    expect(taj.commissionPct).toBe(20);
    expect(taj.supplier).toBe('Supplier B');

    expect(result.find(h => h.name === 'Leela')).toBeDefined();
    expect(result.find(h => h.name === 'Novotel')).toBeDefined();
  });

  // ─── Edge Cases ────────────────────────────────────────────────

  it('returns empty array when both suppliers are empty', () => {
    const result = deduplicateAndSelectBest([], [], 'A', 'B');
    expect(result).toEqual([]);
  });

  it('returns data when one supplier is empty', () => {
    const hotelsA = [makeHotel({ name: 'Solo' })];
    const result = deduplicateAndSelectBest(hotelsA, [], 'A', 'B');

    expect(result).toHaveLength(1);
    expect(result[0].supplier).toBe('A');
  });

  it('performs case-insensitive matching on hotel names', () => {
    const hotelsA = [makeHotel({ name: 'TAJ', price: 12000, commissionPct: 15 })];
    const hotelsB = [makeHotel({ name: 'taj', price: 11000, commissionPct: 10 })];

    const result = deduplicateAndSelectBest(hotelsA, hotelsB, 'A', 'B');

    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(11000);
  });

  it('handles hotel with empty string name', () => {
    const hotelsA = [makeHotel({ name: '', price: 1000 })];
    const hotelsB = [makeHotel({ name: '', price: 900 })];

    const result = deduplicateAndSelectBest(hotelsA, hotelsB, 'A', 'B');

    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(900);
  });

  it('handles hotel with zero price', () => {
    const hotelsA = [makeHotel({ name: 'Free', price: 0, commissionPct: 5 })];
    const hotelsB = [makeHotel({ name: 'Free', price: 100, commissionPct: 10 })];

    const result = deduplicateAndSelectBest(hotelsA, hotelsB, 'A', 'B');

    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(0);
    expect(result[0].supplier).toBe('A');
  });

  it('handles hotel with negative price', () => {
    const hotelsA = [makeHotel({ name: 'Promo', price: -100 })];
    const result = deduplicateAndSelectBest(hotelsA, [], 'A', 'B');

    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(-100);
  });

  it('handles hotels with unicode/accented names', () => {
    const hotelsA = [makeHotel({ name: 'Hôtel Rêve', price: 8000 })];
    const hotelsB = [makeHotel({ name: 'hôtel rêve', price: 7500 })];

    const result = deduplicateAndSelectBest(hotelsA, hotelsB, 'A', 'B');

    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(7500);
  });

  it('handles large dataset without performance issues', () => {
    const hotelsA = Array.from({ length: 500 }, (_, i) =>
      makeHotel({ name: `Hotel-${i}`, price: 1000 + i, hotelId: `A${i}` })
    );
    const hotelsB = Array.from({ length: 500 }, (_, i) =>
      makeHotel({ name: `Hotel-${i}`, price: 999 + i, hotelId: `B${i}` })
    );

    const start = Date.now();
    const result = deduplicateAndSelectBest(hotelsA, hotelsB, 'A', 'B');
    const elapsed = Date.now() - start;

    expect(result).toHaveLength(500);
    expect(elapsed).toBeLessThan(500); // Should be well under 500ms
  });

  it('deduplicates when all hotels are identical across suppliers', () => {
    const hotel = makeHotel({ name: 'Clone', price: 5000, commissionPct: 10 });
    const hotelsA = [hotel, hotel, hotel];
    const hotelsB = [hotel, hotel];

    const result = deduplicateAndSelectBest(hotelsA, hotelsB, 'A', 'B');

    // All have the same name key → only 1 unique
    expect(result).toHaveLength(1);
  });
});
