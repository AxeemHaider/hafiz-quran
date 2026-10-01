/**
 * How many Pages either side of the current one are drawn and kept ready to turn to. Two, so that
 * right after a turn the next Page is already there while the one beyond it is being drawn.
 */
const WINDOW_RADIUS = 2;

/** Whether a Page is in the pager's window: the current Page or one within reach of it. */
export const isInWindow = (layoutPage: number, currentLayoutPage: number) =>
  Math.abs(layoutPage - currentLayoutPage) <= WINDOW_RADIUS;

/** The window's Pages in the order they are drawn: the current one first, then the nearest, the next before the previous. */
export function windowPages(currentLayoutPage: number, pageCount: number): number[] {
  const pages = [currentLayoutPage];
  for (let distance = 1; distance <= WINDOW_RADIUS; distance++) {
    pages.push(currentLayoutPage + distance, currentLayoutPage - distance);
  }
  return pages.filter((page) => page >= 1 && page <= pageCount);
}
