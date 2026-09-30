/** How many Pages either side of the current one are drawn and kept ready to turn to. */
const WINDOW_RADIUS = 1;

/** Whether a Page is in the pager's window: the current Page or one of its neighbours. */
export const isInWindow = (layoutPage: number, currentLayoutPage: number) =>
  Math.abs(layoutPage - currentLayoutPage) <= WINDOW_RADIUS;

/** The window's Pages, the current one first (it is drawn first), then the next and the previous. */
export function windowPages(currentLayoutPage: number, pageCount: number): number[] {
  return [currentLayoutPage, currentLayoutPage + 1, currentLayoutPage - 1].filter(
    (page) => page >= 1 && page <= pageCount && isInWindow(page, currentLayoutPage),
  );
}
