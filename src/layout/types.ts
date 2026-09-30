export type LineType = 'ayah' | 'surah_name' | 'basmallah';
export type Word = { id: number; location: string; text: string };
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
