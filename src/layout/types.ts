export type LineType = 'ayah' | 'surah_name' | 'basmallah';
/** How far a word's ink reaches past its advance width on each side, in em. */
export type InkOverhang = { left: number; right: number };
export type Word = {
  id: number;
  location: string;
  text: string;
  /**
   * Ink past the advance, from data prep; none if absent. Waqf marks after a space hang up to ~0.4 em
   * left of the advance (`عَلَیْهِمْ ۙ۬ۦ`), so the word's box must include them.
   */
  inkOverhangEm?: InkOverhang;
};
export type Line = {
  lineNumber: number;
  type: LineType;
  centered: boolean;
  /** Surah number, for `surah_name` Lines. */
  surah?: number;
  words: Word[];
};
export type Page = { layoutPageNumber: number; lines: Line[] };

/** Width in px of `text` drawn at `fontSize`. The layout's only view of the font. */
export type Measure = (text: string, fontSize: number) => number;

export type Size = { width: number; height: number };
export type Box = { x: number; y: number; w: number; h: number };

/** A Box's width and height as a Size. */
export const sizeOf = ({ w, h }: Pick<Box, 'w' | 'h'>): Size => ({ width: w, height: h });
