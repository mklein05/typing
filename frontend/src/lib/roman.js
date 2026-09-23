// Roman numerals for prestige display. Purely cosmetic.

const NUMERALS = [
  ['M', 1000], ['CM', 900], ['D', 500], ['CD', 400],
  ['C', 100], ['XC', 90], ['L', 50], ['XL', 40],
  ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1],
];

/**
 * Convert a positive integer to Roman numerals. Zero (no prestige yet) returns
 * an empty string, and values above 3999 fall back to the plain number, since
 * standard Roman numerals cannot express them.
 */
export function toRoman(value) {
  const n = Math.floor(Number(value) || 0);
  if (n <= 0) return '';
  if (n > 3999) return String(n);

  let remaining = n;
  let out = '';
  for (const [symbol, amount] of NUMERALS) {
    while (remaining >= amount) {
      out += symbol;
      remaining -= amount;
    }
  }
  return out;
}
