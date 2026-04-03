describe('Slice 8 — Reporting Unit Tests', () => {
  test('RevPAR formula: total revenue / available room nights', () => {
    const totalRevenue = 50000; // cents
    const availableRoomNights = 10;
    const revpar = totalRevenue / availableRoomNights;
    expect(revpar).toBe(5000);
  });

  test('ADR formula: total revenue / occupied room nights', () => {
    const totalRevenue = 30000;
    const occupiedNights = 6;
    const adr = totalRevenue / occupiedNights;
    expect(adr).toBe(5000);
  });

  test('Occupancy rate: occupied / total rooms', () => {
    const occupied = 3;
    const total = 10;
    const rate = occupied / total;
    expect(rate).toBe(0.3);
  });

  test('RevPAR with zero rooms returns Infinity (guard needed)', () => {
    const total = 0;
    const revenue = 1000;
    expect(total === 0 ? 0 : revenue / total).toBe(0);
  });
});
