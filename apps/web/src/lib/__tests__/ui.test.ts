import { describe, it, expect } from 'vitest';
import { metricColor, cn } from '../../components/ui';

describe('ui helpers', () => {
  it('maps metric values to severity colors', () => {
    expect(metricColor(90)).toBe('bg-accent-emerald');
    expect(metricColor(60)).toBe('bg-accent-cyan');
    expect(metricColor(35)).toBe('bg-accent-amber');
    expect(metricColor(10)).toBe('bg-accent');
  });

  it('cn joins truthy class names', () => {
    expect(cn('a', false, null, 'b', undefined)).toBe('a b');
  });
});
