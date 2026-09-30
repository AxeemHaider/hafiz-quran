import type { SQLiteDatabase } from 'expo-sqlite';

import type { Line, LineType, Page } from '@/layout';

import { withSpecialLineContent } from './special-lines';

/** The name the prepared database is imported under in the app's SQLite directory. */
export const MUSHAF_DB_NAME = 'mushaf.db';

/** Mushaf-wide inputs: what the size rule needs, plus the ink extent for placing words. */
export type MushafInfo = {
  name: string;
  pageCount: number;
  linesPerPage: number;
  /** Ink extent of the font above (top) and below (bottom, negative) the baseline, in em. */
  inkTopEm: number;
  inkBottomEm: number;
  inkHeightEm: number;
  /** Each Page's longest justified `ayah` Line in em; Pages with none contribute nothing. */
  longestLineEmByPage: number[];
};

type InfoRow = {
  name: string;
  number_of_pages: number;
  lines_per_page: number;
  ink_top_em: number;
  ink_bottom_em: number;
  ink_height_em: number;
};
type LineRow = { line_number: number; line_type: LineType; is_centered: number; surah_number: number | null };
type WordRow = { id: number; line_number: number; location: string; text: string };

export function readMushafInfo(db: SQLiteDatabase): MushafInfo {
  const info = db.getFirstSync<InfoRow>('select * from mushaf');
  if (!info) throw new Error('Mushaf database has no mushaf row; re-run data prep');
  // Same rule as the layout's justified Line: a non-centred `ayah` Line of more than one word.
  const longest = db.getAllSync<{ em: number }>(
    `select max(width_em) as em from lines
     where line_type = 'ayah' and is_centered = 0 and word_count > 1
     group by page_number`,
  );
  return {
    name: info.name,
    pageCount: info.number_of_pages,
    linesPerPage: info.lines_per_page,
    inkTopEm: info.ink_top_em,
    inkBottomEm: info.ink_bottom_em,
    inkHeightEm: info.ink_height_em,
    longestLineEmByPage: longest.map((r) => r.em),
  };
}

/** A Page's Lines with their words, in order; `surah_name` and `basmallah` Lines carry their app-side text. */
export function readPage(db: SQLiteDatabase, layoutPageNumber: number): Page {
  const lineRows = db.getAllSync<LineRow>(
    'select line_number, line_type, is_centered, surah_number from lines where page_number = ? order by line_number',
    layoutPageNumber,
  );
  const wordRows = db.getAllSync<WordRow>(
    'select id, line_number, location, text from words where page_number = ? order by line_number, position',
    layoutPageNumber,
  );
  const lines: Line[] = lineRows.map((r) => ({
    lineNumber: r.line_number,
    type: r.line_type,
    centered: r.is_centered === 1,
    ...(r.surah_number != null ? { surah: r.surah_number } : {}),
    words: [],
  }));
  const byNumber = new Map(lines.map((l) => [l.lineNumber, l]));
  for (const w of wordRows) byNumber.get(w.line_number)?.words.push({ id: w.id, location: w.location, text: w.text });
  return withSpecialLineContent({ layoutPageNumber, lines });
}
