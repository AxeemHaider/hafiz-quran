import type { SQLiteDatabase } from 'expo-sqlite';

import type { RukuSign } from '@/frame/ruku-signs';
import { isJustified, type Line, type LineType, type Page } from '@/layout';

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
  /** Middle of the ink above the baseline, in em: what gets centred on each Line's centre. */
  inkCenterEm: number;
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
type SizeLineRow = { page_number: number; line_type: LineType; is_centered: number; word_count: number; width_em: number };
type WordRow = {
  id: number;
  line_number: number;
  location: string;
  text: string;
  ink_left_em: number;
  ink_right_em: number;
};

export function readMushafInfo(db: SQLiteDatabase): MushafInfo {
  const info = db.getFirstSync<InfoRow>('select * from mushaf');
  if (!info) throw new Error('Mushaf database has no mushaf row; re-run data prep');
  const lineRows = db.getAllSync<SizeLineRow>(
    'select page_number, line_type, is_centered, word_count, width_em from lines order by page_number',
  );
  const longestByPage = new Map<number, number>();
  for (const r of lineRows) {
    if (!isJustified({ type: r.line_type, centered: r.is_centered === 1, wordCount: r.word_count })) continue;
    longestByPage.set(r.page_number, Math.max(longestByPage.get(r.page_number) ?? 0, r.width_em));
  }
  return {
    name: info.name,
    pageCount: info.number_of_pages,
    linesPerPage: info.lines_per_page,
    inkTopEm: info.ink_top_em,
    inkBottomEm: info.ink_bottom_em,
    inkHeightEm: info.ink_height_em,
    inkCenterEm: (info.ink_top_em + info.ink_bottom_em) / 2,
    longestLineEmByPage: [...longestByPage.values()],
  };
}

/** The ruku signs in a Page's margin, from data prep, in Line order. */
export function readRukuSigns(db: SQLiteDatabase, layoutPageNumber: number): Omit<RukuSign, 'pageNumber'>[] {
  return db.getAllSync<Omit<RukuSign, 'pageNumber'>>(
    `select line_number as lineNumber, in_surah as inSurah, ayah_count as ayahCount, in_para as inPara
     from ruku_signs where page_number = ? order by line_number`,
    layoutPageNumber,
  );
}

/** A Page's Lines with their words, in order; `surah_name` and `basmallah` Lines carry their app-side text. */
export function readPage(db: SQLiteDatabase, layoutPageNumber: number): Page {
  const lineRows = db.getAllSync<LineRow>(
    'select line_number, line_type, is_centered, surah_number from lines where page_number = ? order by line_number',
    layoutPageNumber,
  );
  const wordRows = db.getAllSync<WordRow>(
    'select id, line_number, location, text, ink_left_em, ink_right_em from words where page_number = ? order by line_number, position',
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
  for (const w of wordRows)
    byNumber.get(w.line_number)?.words.push({
      id: w.id,
      location: w.location,
      text: w.text,
      inkOverhangEm: { left: w.ink_left_em, right: w.ink_right_em },
    });
  return withSpecialLineContent({ layoutPageNumber, lines });
}
