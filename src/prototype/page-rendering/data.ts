// PROTOTYPE (ticket #6). Page data + fonts copied from sandbox by scripts/prototype-page-data.mjs.
import pagesJson from './local/pages.json';

export type Word = { id: number; loc: string; text: string };
export type Line = {
  line: number;
  type: 'ayah' | 'surah_name' | 'basmallah';
  centered: boolean;
  surah: number | string;
  words: Word[];
};
export type Page = { page: number; lines: Line[] };
/** A drawable unit on a Line: a word, or a piece of a placeholder special Line. */
export type Unit = { key: string; text: string; loc: string };

export const PAGES = pagesJson as Page[];
export const LINES_PER_PAGE = 16;
const BASMALLAH = 'بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِیْمِ';

export const FONT_SOURCES = {
  HanafiNormal: require('./local/B-hanafi-normal.ttf'),
  HanafiCompact: require('./local/B-hanafi-compact.ttf'),
  HanafiCompressed: require('./local/B-hanafi-compressed.ttf'),
};
export type FontName = keyof typeof FONT_SOURCES;
export const FONT_NAMES = Object.keys(FONT_SOURCES) as FontName[];
export const REFERENCE_IMAGE = require('./local/reference-p401.jpg');

export function lineUnits(line: Line): Unit[] {
  if (line.type === 'ayah')
    return line.words.map((w) => ({ key: String(w.id), text: w.text, loc: w.loc }));
  // Special Lines are placeholders here (map fog: "Special Lines", "Page Frame assets").
  const text = line.type === 'basmallah' ? BASMALLAH : `سُوْرَةُ ${line.surah}`;
  return text.split(' ').map((t, i) => ({ key: `${line.type}-${i}`, text: t, loc: line.type }));
}

/** Justified = stretched edge to edge; everything else is centred at natural spacing. */
export const isJustified = (line: Line) => line.type === 'ayah' && !line.centered && line.words.length > 1;
