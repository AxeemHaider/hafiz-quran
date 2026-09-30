import { isInWindow, windowPages } from '@/reader/page-window';

describe('isInWindow', () => {
  test('only the current Page and its neighbours are drawn', () => {
    const drawn = [1, 2, 3, 4, 5, 6, 7].filter((page) => isInWindow(page, 4));
    expect(drawn).toEqual([3, 4, 5]);
  });

  test('at the first Page the window is the Page and its one neighbour', () => {
    expect([1, 2, 3].filter((page) => isInWindow(page, 1))).toEqual([1, 2]);
  });
});

describe('windowPages', () => {
  test('the current Page comes first, so it is drawn before the Pages to turn to', () => {
    expect(windowPages(4, 548)).toEqual([4, 5, 3]);
  });

  test('stays inside the Mushaf at either end', () => {
    expect(windowPages(1, 548)).toEqual([1, 2]);
    expect(windowPages(548, 548)).toEqual([548, 547]);
  });
});
