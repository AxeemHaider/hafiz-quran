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
