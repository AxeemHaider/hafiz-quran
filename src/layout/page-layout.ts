import type { Tuning } from './tuning';
import type { Box, Line, LineType, Measure, Page, Size } from './types';

export type PlacedWord = {
  id: number;
  location: string;
  text: string;
  /** Hit-test box in text-area coordinates: the widened width and the full Line pitch. */
  box: Box;
  /** Width of the word as measured at the Page's font size, before widening. */
  measuredWidth: number;
  /**
   * The word's right edge (= box.x + box.w). The renderer lays the word out RTL at `measuredWidth`,
   * pins its right edge here, then widens it leftward by the Line's `scaleX`.
   */
  anchorX: number;
};

export type PlacedLine = {
  lineNumber: number;
  type: LineType;
  /** Horizontal scale applied to every word of the Line (how much its words are widened). */
  scaleX: number;
  /** Vertical stretch of every word, applied around `centerY`. Never affects widths. */
  scaleY: number;
  /** Vertical centre of the Line, the anchor of the vertical stretch. */
  centerY: number;
  words: PlacedWord[];
};

export type PageLayout = {
  /** The Page's font size: the Mushaf size, or smaller if this Page's measured Lines don't fit at it. */
  fontSize: number;
  /** Height of one Line: text-area height ÷ Lines per Page, the same on every Page. */
  pitch: number;
  /** Top of the first Line. Non-zero when a Page has fewer Lines than Lines per Page (centred). */
  offsetY: number;
  lines: PlacedLine[];
};

export type PageLayoutInput = {
  page: Page;
  linesPerPage: number;
  measure: Measure;
  textArea: Size;
  fontSize: number;
  tuning: Tuning;
};

/** A justified Line runs edge to edge; every other Line is centred at its natural width. */
const isJustified = (line: Line) => line.type === 'ayah' && !line.centered && line.words.length > 1;

/** Sub-pixel slack for float error when checking whether a Line fits. */
const FIT_EPSILON = 1e-6;
const MAX_SHRINK_STEPS = 50;

/** Width of a Line's measured words plus its gaps, at `fontSize`. */
function naturalWidth(line: Line, measure: Measure, fontSize: number, wordGapEm: number) {
  const words = line.words.reduce((sum, w) => sum + measure(w.text, fontSize), 0);
  return words + wordGapEm * fontSize * (line.words.length - 1);
}

/**
 * The Mushaf size, or the largest smaller size at which every justified Line's measured words fit the
 * width. Re-measures after each step, because a device shaper's widths aren't exactly linear in size.
 */
function pageFontSize(page: Page, measure: Measure, width: number, fontSize: number, wordGapEm: number) {
  const justified = page.lines.filter(isJustified);
  let size = fontSize;
  for (let step = 0; step < MAX_SHRINK_STEPS; step++) {
    const widest = Math.max(0, ...justified.map((l) => naturalWidth(l, measure, size, wordGapEm)));
    if (widest <= width + FIT_EPSILON) return size;
    size *= width / widest;
  }
  return size;
}

export function layoutPage({ page, linesPerPage, measure, textArea, fontSize: mushafSize, tuning }: PageLayoutInput): PageLayout {
  const fontSize = pageFontSize(page, measure, textArea.width, mushafSize, tuning.wordGapEm);
  const pitch = textArea.height / linesPerPage;
  const offsetY = (textArea.height - page.lines.length * pitch) / 2;
  const gap = tuning.wordGapEm * fontSize;
  return {
    fontSize,
    pitch,
    offsetY,
    lines: page.lines.map((line, i) => {
      const y = offsetY + i * pitch;
      const widths = line.words.map((w) => measure(w.text, fontSize));
      const sum = widths.reduce((a, b) => a + b, 0);
      const gaps = gap * (line.words.length - 1);
      const fill = (textArea.width - gaps) / sum;
      const scaleX = isJustified(line) ? fill : Math.min(1, fill);
      let x = (textArea.width + sum * scaleX + gaps) / 2;
      return {
        lineNumber: line.lineNumber,
        type: line.type,
        scaleX,
        scaleY: tuning.verticalStretch,
        centerY: y + pitch / 2,
        words: line.words.map((word, j) => {
          const anchorX = x;
          const w = widths[j] * scaleX;
          x -= w;
          const box = { x, y, w, h: pitch };
          x -= gap;
          return { ...word, box, measuredWidth: widths[j], anchorX };
        }),
      };
    }),
  };
}
