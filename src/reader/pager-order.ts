/**
 * The one place that decides which list index shows which Page in the horizontal pager.
 *
 * The book turns right to left: the next Page comes in from the left. A horizontal list puts
 * index 0 at the left in an LTR layout and at the right in an RTL layout (React Native mirrors
 * horizontal lists when `I18nManager.isRTL`), so the order depends on the layout direction.
 */
export type PagerOrder = {
  /** The list index that shows a layout Page (1-based). */
  indexOf: (layoutPage: number) => number;
  /** The layout Page shown at a list index. */
  pageAt: (index: number) => number;
};

export function pagerOrder(pageCount: number, isRTL: boolean): PagerOrder {
  if (isRTL) return { indexOf: (page) => page - 1, pageAt: (index) => index + 1 };
  return { indexOf: (page) => pageCount - page, pageAt: (index) => pageCount - index };
}

/** How many Pages either side of the current one are laid out and mounted. */
const WINDOW_RADIUS = 1;

/** Whether a Page is in the pager's window: the current Page or one of its neighbours. */
export const isInWindow = (layoutPage: number, currentLayoutPage: number) =>
  Math.abs(layoutPage - currentLayoutPage) <= WINDOW_RADIUS;
