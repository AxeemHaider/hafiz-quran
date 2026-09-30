import { isInWindow, pagerOrder } from '@/reader/pager-order';

describe('isInWindow', () => {
  test('only the current Page and its neighbours are laid out and mounted', () => {
    const mounted = [1, 2, 3, 4, 5, 6, 7].filter((page) => isInWindow(page, 4));
    expect(mounted).toEqual([3, 4, 5]);
  });

  test('at the first Page the window is the Page and its one neighbour', () => {
    expect([1, 2, 3].filter((page) => isInWindow(page, 1))).toEqual([1, 2]);
  });
});

// A horizontal list puts index 0 at the left in an LTR layout and at the right in an RTL layout.
// Either way the next Page must sit to the left of the current one, as in the book.
describe('pagerOrder', () => {
  test('in an LTR layout the first Page is the rightmost item and the last Page the leftmost', () => {
    const order = pagerOrder(548, false);
    expect(order.indexOf(1)).toBe(547);
    expect(order.indexOf(548)).toBe(0);
    expect(order.indexOf(2)).toBe(546); // next Page one step to the left
  });

  test('in an RTL layout the list already runs right to left, so the Pages keep their order', () => {
    const order = pagerOrder(548, true);
    expect(order.indexOf(1)).toBe(0);
    expect(order.indexOf(2)).toBe(1);
    expect(order.indexOf(548)).toBe(547);
  });

  test.each([false, true])('the Page at an index is the Page that index shows (RTL: %s)', (isRTL) => {
    const order = pagerOrder(10, isRTL);
    for (let page = 1; page <= 10; page++) expect(order.pageAt(order.indexOf(page))).toBe(page);
  });
});
