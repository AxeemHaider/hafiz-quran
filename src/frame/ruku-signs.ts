import type { PlacedLine } from '@/layout';

import { toUrduDigits } from './digits';
import type { FrameGeometry } from './page-frame';
import { paraAt } from './paras';

// Also imported by data prep (scripts/prepare-mushaf.mjs) under Node's type stripping: keep runtime
// imports to plain TS modules, and type-only imports as `import type`.

/** One ruku from the QUL ruku metadata: its number in the Mushaf and in its surah, and where it ends. */
export type Ruku = { rukuNumber: number; surahRukuNumber: number; ayahCount: number; lastAyahKey: string };

export type LinePosition = { pageNumber: number; lineNumber: number };

/**
 * The printed ruku sign at a ruku's end: the Line it is level with, and its three numbers (the ruku's
 * number in its surah, its Ayah count, and its number in its Para).
 */
export type RukuSign = LinePosition & { inSurah: number; ayahCount: number; inPara: number };
/** A ruku sign on a known Page: what data prep stores per Page and the reader draws. */
export type PageRukuSign = Omit<RukuSign, 'pageNumber'>;

/**
 * Each ruku's sign, in ruku order. `lineOfAyahEnd` finds the Line holding the last word of an Ayah
 * (`surah:ayah`). A ruku counts toward the Para it ends in, so the rukus must come in Mushaf order.
 * Throws if they don't, or if a ruku's last Ayah is on no Line.
 */
export function rukuSigns(
  rukus: readonly Ruku[],
  lineOfAyahEnd: (ayahKey: string) => LinePosition | undefined,
): RukuSign[] {
  let para = 0;
  let inPara = 0;
  return rukus.map((ruku, i) => {
    if (i > 0 && ruku.rukuNumber <= rukus[i - 1].rukuNumber)
      throw new Error(`Rukus out of order: ${ruku.rukuNumber} comes after ${rukus[i - 1].rukuNumber}`);
    const line = lineOfAyahEnd(ruku.lastAyahKey);
    if (!line) throw new Error(`Ruku ${ruku.rukuNumber} ends at ${ruku.lastAyahKey}, which is on no Line`);
    const endsIn = paraAt(ruku.lastAyahKey).number;
    inPara = endsIn === para ? inPara + 1 : 1;
    para = endsIn;
    return { ...line, inSurah: ruku.surahRukuNumber, ayahCount: ruku.ayahCount, inPara };
  });
}

/**
 * The sign's sizes and offsets, as proportions of the margin column's width, modelled on the Taj
 * reference Page (`docs/QuranPage.jpg`): an upright ع with its number in surah above, its Ayah count
 * inside its lower bowl, and its number in Para below. The offsets fit this font's ع: re-check them
 * after a font swap.
 */
const SIGN = {
  letterSize: 1,
  digitSize: 0.5,
  insideDigitSize: 0.42,
  /** The ع's glyph sits low in its em: raise it so its ink is level with the Line's centre. */
  letterY: -0.2,
  /** Centre of the numbers above and below the ع, from the Line's centre. */
  aboveY: -1,
  belowY: 0.85,
  /** Centre of the Ayah count, inside the ع's lower bowl, from the Line's centre. */
  insideX: 0.06,
  insideY: 0.02,
} as const;

/** One text of a ruku sign, centred on (centerX, centerY) in Page coordinates. */
export type SignText = { text: string; fontSize: number; centerX: number; centerY: number };

/** The texts a ruku sign is drawn from. */
export const RUKU_SIGN_PARTS = ['letter', 'above', 'inside', 'below'] as const;

export type PlacedRukuSign = { lineNumber: number } & Record<(typeof RUKU_SIGN_PARTS)[number], SignText>;

/**
 * Where a Page's ruku signs go: in the middle of the frame's margin column, each ع level with the
 * centre of its Line (`lines` from the Page layout, in text-area coordinates). Numbers in Urdu digits.
 * Throws for a sign whose Line isn't on the Page.
 */
export function rukuSignPlacements(
  signs: readonly PageRukuSign[],
  lines: readonly Pick<PlacedLine, 'lineNumber' | 'centerY'>[],
  { marginColumn, textArea }: Pick<FrameGeometry, 'marginColumn' | 'textArea'>,
): PlacedRukuSign[] {
  const w = marginColumn.w;
  const centerX = marginColumn.x + w / 2;
  return signs.map((sign) => {
    const line = lines.find((l) => l.lineNumber === sign.lineNumber);
    if (!line) throw new Error(`Ruku sign for Line ${sign.lineNumber}, which is not on the Page`);
    const centerY = textArea.y + line.centerY;
    const digits = (n: number, size: number, dx: number, dy: number): SignText => ({
      text: toUrduDigits(n),
      fontSize: size * w,
      centerX: centerX + dx * w,
      centerY: centerY + dy * w,
    });
    return {
      lineNumber: sign.lineNumber,
      letter: { text: 'ع', fontSize: SIGN.letterSize * w, centerX, centerY: centerY + SIGN.letterY * w },
      above: digits(sign.inSurah, SIGN.digitSize, 0, SIGN.aboveY),
      inside: digits(sign.ayahCount, SIGN.insideDigitSize, SIGN.insideX, SIGN.insideY),
      below: digits(sign.inPara, SIGN.digitSize, 0, SIGN.belowY),
    };
  });
}
