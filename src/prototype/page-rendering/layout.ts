// PROTOTYPE (ticket #6). Pure page-fit + placement math shared by all variants.
import { LINES_PER_PAGE } from './data';

/** Wall clock for build timings (wrapped so render-time timing reads as intentional). */
export const now = () => performance.now();

/** How the Page size is chosen. minGap = smallest inter-word gap as a fraction of a normal space. */
/** widen = fill each justified Line by widening its words (gaps stay at minGap), not by widening gaps. */
export type FitRule = { minGap: number; ink: boolean; widen: boolean };
/**
 * Ink height of the QUL Indopak Nastaleeq builds in em (-0.45..1.18), measured offline with HarfBuzz over
 * page 400. The font's own line height is 2.11 em, so fitting by it wastes ~30% of each Line's pitch.
 */
export const INK_EM = 1.63;

export type Box = { x: number; y: number; w: number; h: number };
export type Fit = {
  size: number;
  widthSize: number;
  heightSize: number;
  bind: 'width' | 'height';
  pitch: number;
};
export type Stats = Fit & { buildMs: number; gapMin: number; gapMax: number; overflow: boolean; sxMax: number };

/**
 * One font size for the whole Page: the largest size at which every Line fits W with at least
 * minGap × a normal space between words, and the ink (or the font's line height) fits H/16.
 */
export function fitPage(
  widths100: number[][],
  space100: number,
  lineHeight100: number,
  W: number,
  H: number,
  rule: FitRule,
): Fit {
  let widthSize = Infinity;
  for (const ws of widths100) {
    const natural = ws.reduce((a, b) => a + b, 0) + rule.minGap * space100 * (ws.length - 1);
    widthSize = Math.min(widthSize, (W * 100) / natural);
  }
  const pitch = H / LINES_PER_PAGE;
  const heightSize = rule.ink ? pitch / INK_EM : (pitch * 100) / lineHeight100;
  const size = Math.floor(Math.min(widthSize, heightSize) * 10) / 10;
  return { size, widthSize, heightSize, bind: widthSize <= heightSize ? 'width' : 'height', pitch };
}

/**
 * Places words right-to-left. Returns boxes (drawn width; row = full pitch, for hit-testing), the gap
 * per Line, and sx per Line: the horizontal scale applied to its words (1 unless widening).
 * widenGap: when set, justified Lines keep this gap and widen their words to fill W instead.
 */
export function placeLines(
  widths: number[][],
  justified: boolean[],
  space: number,
  W: number,
  pitch: number,
  widenGap: number | null = null,
) {
  const gaps: number[] = [];
  const sx: number[] = [];
  const boxes = widths.map((ws, i) => {
    const sum = ws.reduce((a, b) => a + b, 0);
    const widen = justified[i] && widenGap !== null;
    const gap = widen ? widenGap : justified[i] ? (W - sum) / (ws.length - 1) : space;
    const s = widen ? (W - gap * (ws.length - 1)) / sum : 1;
    gaps.push(gap);
    sx.push(s);
    let x = justified[i] ? W : (W + sum + gap * (ws.length - 1)) / 2;
    return ws.map((w) => {
      x -= w * s;
      const box = { x, y: i * pitch, w: w * s, h: pitch };
      x -= gap;
      return box;
    });
  });
  return { boxes, gaps, sx };
}

export function gapStats(gaps: number[], justified: boolean[], space: number) {
  const g = gaps.filter((_, i) => justified[i]).map((x) => x / space);
  return { gapMin: Math.min(...g), gapMax: Math.max(...g) };
}

export const hit = (boxes: Box[][], x: number, y: number) => {
  for (let i = 0; i < boxes.length; i++)
    for (let j = 0; j < boxes[i].length; j++) {
      const b = boxes[i][j];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return [i, j] as const;
    }
  return null;
};
