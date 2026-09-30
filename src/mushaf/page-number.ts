/**
 * The one mapping between the Mushaf Layout's page number and the printed page number.
 * Printed = layout + 1, checked only at printed Page 401 (spec #10): if the offset turns out not to be
 * constant, fix it here and nowhere else.
 */
const PRINTED_OFFSET = 1;

export const printedFromLayout = (layoutPage: number) => layoutPage + PRINTED_OFFSET;
export const layoutFromPrinted = (printedPage: number) => printedPage - PRINTED_OFFSET;

/** The Page the app opens at: layout Page 1. */
export const DEFAULT_PRINTED_PAGE = printedFromLayout(1);

/** Which side of the open Mushaf a Page is on; its margin column is on that side too. */
export type PageSide = 'right' | 'left';

/**
 * Al-Fatiha, the first printed Page (printed 2), is a right-hand page and the sides alternate, so even
 * printed pages are on the right. The reference photo of printed 401 has its margin on the right
 * anyway; the margin follows the Page's own side by choice.
 */
export const pageSide = (printedPage: number): PageSide => (printedPage % 2 === 0 ? 'right' : 'left');
