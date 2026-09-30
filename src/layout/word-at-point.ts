import type { PageLayout, PlacedWord } from './page-layout';

/**
 * The word whose box contains (x, y), in text-area coordinates, or null. Boxes are half-open
 * ([x, x + w) × [y, y + h)) so a point on a shared edge belongs to exactly one word.
 */
export function wordAtPoint(layout: PageLayout, x: number, y: number): PlacedWord | null {
  for (const line of layout.lines) {
    for (const word of line.words) {
      const b = word.box;
      if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return word;
    }
  }
  return null;
}
