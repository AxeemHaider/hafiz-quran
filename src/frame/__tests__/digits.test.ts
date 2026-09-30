import { toUrduDigits } from '../digits';

describe('Urdu digits', () => {
  test('writes a number in Urdu/Eastern Arabic digits, most significant first', () => {
    expect(toUrduDigits(401)).toBe('۴۰۱');
    expect(toUrduDigits(23)).toBe('۲۳');
    expect(toUrduDigits(5678)).toBe('۵۶۷۸');
    expect(toUrduDigits(9)).toBe('۹');
  });
});
