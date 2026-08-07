import { checkReturnWindow } from './returns-eligibility';

/**
 * DOM-RETURNS Invariant 3 and §8.1/§8.3 — the boundary arithmetic, which is
 * where a window rule is actually got wrong.
 */
describe('checkReturnWindow', () => {
  const delivered = new Date('2026-08-01T10:00:00.000Z');
  const days = (n: number) => new Date(delivered.getTime() + n * 86_400_000);

  it('allows a request on the day of delivery', () => {
    expect(checkReturnWindow(delivered, 10, delivered).eligible).toBe(true);
  });

  it('allows day 10 and refuses day 11 (§8.1)', () => {
    expect(checkReturnWindow(delivered, 10, days(10)).eligible).toBe(true);
    expect(checkReturnWindow(delivered, 10, days(11)).eligible).toBe(false);
  });

  it('treats the deadline instant itself as inside the window', () => {
    // Exactly 10 days after delivery, to the millisecond. `>` not `>=` — a
    // customer on the boundary gets the benefit.
    const result = checkReturnWindow(delivered, 10, days(10));
    expect(result.eligible).toBe(true);
  });

  it('refuses one millisecond past the deadline', () => {
    const past = new Date(days(10).getTime() + 1);
    expect(checkReturnWindow(delivered, 10, past).eligible).toBe(false);
  });

  it('reports the deadline date in the refusal', () => {
    const result = checkReturnWindow(delivered, 10, days(30));
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.reason).toContain('2026-08-11');
      expect(result.reason).toContain('10-day');
    }
  });

  it('honours a changed window rather than a hardcoded 10', () => {
    // The whole point of FEAT-SETTINGS-STORE: day 20 is outside a 10-day
    // window and inside a 30-day one.
    expect(checkReturnWindow(delivered, 10, days(20)).eligible).toBe(false);
    expect(checkReturnWindow(delivered, 30, days(20)).eligible).toBe(true);
  });

  it('returns the deadline so callers can show it', () => {
    const result = checkReturnWindow(delivered, 10, delivered);
    expect(result.eligible && result.deadline.toISOString()).toBe('2026-08-11T10:00:00.000Z');
  });

  it('refuses, rather than inventing a date, when no DELIVERED entry exists', () => {
    const result = checkReturnWindow(null, 10, delivered);
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toMatch(/contact support/i);
  });

  it('is evaluated at the instant passed in, not at the wall clock (§8.3)', () => {
    // Eligibility is decided at request time; nothing here reads Date.now(),
    // which is what lets a pending request survive a later window change.
    const spy = jest.spyOn(Date, 'now');
    checkReturnWindow(delivered, 10, days(3));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
