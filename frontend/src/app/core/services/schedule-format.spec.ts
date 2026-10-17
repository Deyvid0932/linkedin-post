import { describe, expect, it } from 'vitest';
import { parseRecurring } from './schedule-format';
describe('recurring schedule recognition', () => {
  it('recognizes only the three supported patterns', () => {
    expect(parseRecurring('0 30 9 * * ?')?.days).toHaveLength(7);
    expect(parseRecurring('0 0 10 ? * MON-FRI')?.days).toEqual([0, 1, 2, 3, 4]);
    expect(parseRecurring('0 15 8 ? * MON,WED,FRI')?.days).toEqual([0, 2, 4]);
  });
  it('preserves unrecognized and invalid cron expressions as custom', () => {
    expect(parseRecurring('0 0 9 1 * ?')).toBeNull();
    expect(parseRecurring('0 99 25 * * ?')).toBeNull();
  });
});
