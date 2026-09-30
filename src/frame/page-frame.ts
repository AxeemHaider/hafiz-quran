import type { Box, Page, PageLayout } from '@/layout';
import { surahName } from '@/mushaf/surah-names';

import { toUrduDigits } from './digits';
import { paraAt } from './paras';

/**
 * The Page Frame's sizes, as proportions of the Page box, modelled on the Taj reference Page
 * (`docs/QuranPage.jpg`). Separate from the layout's tuning: they shape the frame, not the Lines.
 */
const FRAME = {
  /** Header strip height, of the Page height. */
  headerHeight: 0.045,
  /** Gap between the Page edge and the outer rule (left, right, bottom), of the Page width. */
  edgeInset: 0.012,
  /** Right-hand margin column for ruku and waqf notes, of the Page width. */
  marginColumn: 0.06,
  /** Outer (heavier) and inner rule of the double-rule border, and the rule under each Line. */
  outerRule: 0.005,
  innerRule: 0.0025,
  lineRule: 0.0015,
  /** Gap between the two rules of the border. */
  ruleGap: 0.008,
  /** Gap between the inner rule and the Lines. */
  textInset: 0.01,
} as const;

export type FrameGeometry = {
  /** Header strip: surah name, printed page number, Para. */
  header: Box;
  /** Centre lines of the border's two rules. */
  outerBorder: Box;
  innerBorder: Box;
  /** Holds the ruku signs (`ruku-signs.ts`); waqf notes will go here too. */
  marginColumn: Box;
  /** What's left for the Lines: the text area the Page layout receives. */
  textArea: Box;
  ruleWidths: { outer: number; inner: number; line: number };
};

/** Lays the Page Frame out in a Page box of this width and height, in Page coordinates. */
export function frameGeometry({ w: width, h: height }: Pick<Box, 'w' | 'h'>): FrameGeometry {
  const ofWidth = (proportion: number) => proportion * width;
  const header: Box = { x: 0, y: 0, w: width, h: FRAME.headerHeight * height };
  const edge = ofWidth(FRAME.edgeInset);
  const marginW = ofWidth(FRAME.marginColumn);

  const outerBorder: Box = {
    x: edge,
    y: header.h,
    w: width - 2 * edge - marginW,
    h: height - header.h - edge,
  };
  const innerBorder = inset(outerBorder, ofWidth(FRAME.ruleGap));
  const textArea = inset(innerBorder, ofWidth(FRAME.textInset));
  const marginColumn: Box = { x: outerBorder.x + outerBorder.w, y: outerBorder.y, w: marginW, h: outerBorder.h };

  return {
    header,
    outerBorder,
    innerBorder,
    marginColumn,
    textArea,
    ruleWidths: { outer: ofWidth(FRAME.outerRule), inner: ofWidth(FRAME.innerRule), line: ofWidth(FRAME.lineRule) },
  };
}

/** Below this offset a Page's Lines fill the text area: its last Line sits on the border. */
const FULL_PAGE_EPSILON = 1e-6;

/**
 * Where the thin rule under each of a laid-out Page's Lines goes: y positions in text-area coordinates.
 * On a full Page the last Line's rule would sit on the border, so it is left out; a short, vertically
 * centred Page keeps a rule under its last Line too.
 */
export function lineRuleYs({ pitch, offsetY, lines }: Pick<PageLayout, 'pitch' | 'offsetY' | 'lines'>): number[] {
  const ys = lines.map((_, i) => offsetY + (i + 1) * pitch);
  return offsetY <= FULL_PAGE_EPSILON ? ys.slice(0, -1) : ys;
}

export type PageHeader ={ surah: string; pageNumber: string; para: string };

/**
 * The header's three texts: the surah and the Para of the Page's first `ayah` word (name and number),
 * and the printed page number, all numbers in Urdu digits.
 */
export function pageHeader(page: Page, printedPage: number): PageHeader {
  const first = page.lines.find((l) => l.type === 'ayah' && l.words.length > 0)?.words[0];
  if (!first) throw new Error(`Page ${page.layoutPageNumber} has no ayah word for its header`);
  const surah = Number(first.location.split(':')[0]);
  const para = paraAt(first.location);
  return {
    surah: `${surahName(surah)} ${toUrduDigits(surah)}`,
    pageNumber: toUrduDigits(printedPage),
    para: `${para.name} ${toUrduDigits(para.number)}`,
  };
}

const inset =(b: Box, d: number): Box => ({ x: b.x + d, y: b.y + d, w: b.w - 2 * d, h: b.h - 2 * d });
