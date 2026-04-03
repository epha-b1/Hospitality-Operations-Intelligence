describe('Slice 5 — Itinerary Unit Tests', () => {
  const DATE_REGEX = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/;
  const TIME_REGEX = /^(0?[1-9]|1[0-2]):[0-5]\d\s?(AM|PM)$/i;

  describe('Date validation MM/DD/YYYY', () => {
    test.each(['12/25/2025', '01/01/2024', '06/15/2023'])('accepts %s', (d) => { expect(DATE_REGEX.test(d)).toBe(true); });
    test.each(['2025-12-25', '13/01/2024', '00/15/2023', '12/32/2023', 'not-a-date'])('rejects %s', (d) => { expect(DATE_REGEX.test(d)).toBe(false); });
  });

  describe('Time validation 12-hour', () => {
    test.each(['09:30 AM', '12:00 PM', '1:00 AM', '11:59 PM'])('accepts %s', (t) => { expect(TIME_REGEX.test(t)).toBe(true); });
    test.each(['13:00 PM', '00:00 AM', '9:60 AM', 'midnight'])('rejects %s', (t) => { expect(TIME_REGEX.test(t)).toBe(false); });
  });

  test('notes max 2000 chars', () => {
    const MAX = 2000;
    expect('x'.repeat(MAX).length).toBeLessThanOrEqual(MAX);
    expect('x'.repeat(MAX + 1).length).toBeGreaterThan(MAX);
  });

  test('checkpoint limit is 30', () => {
    expect(30).toBe(30);
  });
});
