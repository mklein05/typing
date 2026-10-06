import { describe, it, expect } from 'vitest';

import { toRoman } from './roman';

describe('toRoman', () => {
  it('returns an empty string for zero and negatives', () => {
    expect(toRoman(0)).toBe('');
    expect(toRoman(-3)).toBe('');
  });

  it('handles the subtractive forms', () => {
    expect(toRoman(1)).toBe('I');
    expect(toRoman(4)).toBe('IV');
    expect(toRoman(9)).toBe('IX');
    expect(toRoman(40)).toBe('XL');
    expect(toRoman(90)).toBe('XC');
    expect(toRoman(400)).toBe('CD');
    expect(toRoman(900)).toBe('CM');
  });

  it('handles cumulative forms', () => {
    expect(toRoman(3)).toBe('III');
    expect(toRoman(8)).toBe('VIII');
    expect(toRoman(49)).toBe('XLIX');
    expect(toRoman(1994)).toBe('MCMXCIV');
    expect(toRoman(3999)).toBe('MMMCMXCIX');
  });

  it('falls back to the plain number above 3999', () => {
    expect(toRoman(4000)).toBe('4000');
    expect(toRoman(12345)).toBe('12345');
  });
});
