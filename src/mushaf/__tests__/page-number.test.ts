import { pageSide } from '../page-number';

describe('which side of the open Mushaf a Page is on', () => {
  test('Al-Fatiha, the first printed Page (printed 2), is a right-hand Page, and the sides alternate from there', () => {
    expect(pageSide(2)).toBe('right');
    expect(pageSide(3)).toBe('left');
    expect(pageSide(4)).toBe('right');
  });

  test('printed Page 401 is a left-hand Page, so its margin is on the left', () => {
    // The reference photo (docs/QuranPage.jpg) shows it on the right; the hafiz chose the Page's own side.
    expect(pageSide(401)).toBe('left');
  });
});
