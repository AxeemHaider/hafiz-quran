import type { Line, Page } from '@/layout';

import { surahName } from './surah-names';

/** The word that opens every `surah_name` Line. */
export const SURAH_WORD = 'سُوْرَةُ';

/**
 * بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِیْمِ in the Indopak Nastaleeq script's own spelling. Escaped because
 * the script puts shadda before its vowel, which editors tend to silently reorder.
 */
export const BASMALLAH =
  'بِسْمِ اللّٰهِ ' +
  'الرَّحْمٰنِ الرَّحِیْمِ';

/**
 * Gives a Page's `surah_name` and `basmallah` Lines their text, so they go through the same font,
 * measurer and layout as `ayah` Lines, centred. Each gets its whole text as one word.
 *
 * A special Line's word is not a Quran word: its id is minus its Line number (so it is unique on the
 * Page and never clashes with Quran word ids, which start at 1) and its location is empty.
 */
export function withSpecialLineContent(page: Page): Page {
  return { ...page, lines: page.lines.map(withContent) };
}

function withContent(line: Line): Line {
  if (line.type === 'ayah') return line;
  const text = line.type === 'surah_name' ? `${SURAH_WORD} ${surahName(line.surah ?? 0)}` : BASMALLAH;
  return { ...line, centered: true, words: [{ id: -line.lineNumber, location: '', text }] };
}
