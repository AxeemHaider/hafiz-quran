import { isInWindow, windowPages } from '@/reader/page-window';

describe('isInWindow', () => {
  test('the current Page and the two either side of it are drawn', () => {
    const drawn = [1, 2, 3, 4, 5, 6, 7].filter((page) => isInWindow(page, 4));
    expect(drawn).toEqual([2, 3, 4, 5, 6]);
  });

  test('at the first Page the window is the Page and the two after it', () => {
    expect([1, 2, 3, 4].filter((page) => isInWindow(page, 1))).toEqual([1, 2, 3]);
  });
});

describe('windowPages', () => {
  test('the current Page comes first, then the nearest Pages, so a turn is ready as soon as it can be', () => {
    expect(windowPages(4, 548)).toEqual([4, 5, 3, 6, 2]);
  });

  test('stays inside the Mushaf at either end', () => {
    expect(windowPages(1, 548)).toEqual([1, 2, 3]);
    expect(windowPages(2, 548)).toEqual([2, 3, 1, 4]);
    expect(windowPages(548, 548)).toEqual([548, 547, 546]);
  });
});
