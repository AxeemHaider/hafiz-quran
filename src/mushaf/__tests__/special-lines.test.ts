import type { Line, Page } from '@/layout';

import { withSpecialLineContent } from '../special-lines';

const page = (...lines: Line[]): Page => ({ layoutPageNumber: 7, lines });

describe('special Line content', () => {
  test('a surah_name Line draws "سُوْرَةُ" plus the surah name as one centred word', () => {
    const [line] = withSpecialLineContent(
      page({ lineNumber: 3, type: 'surah_name', centered: false, surah: 2, words: [] }),
    ).lines;
    expect(line.centered).toBe(true);
    expect(line.words.map((w) => w.text)).toEqual(['سُوْرَةُ البقرة']);
  });

  test('a basmallah Line draws the Indopak basmallah as one centred word', () => {
    const [line] = withSpecialLineContent(page({ lineNumber: 2, type: 'basmallah', centered: false, words: [] })).lines;
    expect(line.centered).toBe(true);
    // Indopak spelling: shadda before its vowel, superscript alef, Farsi yeh (U+06CC) in الرَّحِیْمِ.
    const basmallah =
      'بِسْمِ اللّٰهِ ' +
      'الرَّحْمٰنِ الرَّحِیْمِ';
    expect(line.words.map((w) => w.text)).toEqual([basmallah]);
  });

  test('ayah Lines are left exactly as they are', () => {
    const ayah: Line = { lineNumber: 4, type: 'ayah', centered: false, words: [{ id: 9, location: '2:1:1', text: 'x' }] };
    expect(withSpecialLineContent(page(ayah)).lines).toEqual([ayah]);
  });

  test('special-Line words have ids distinct across the Page and outside the Quran word ids (1..)', () => {
    const lines = withSpecialLineContent(
      page(
        { lineNumber: 1, type: 'surah_name', centered: true, surah: 113, words: [] },
        { lineNumber: 2, type: 'basmallah', centered: true, words: [] },
        { lineNumber: 3, type: 'ayah', centered: false, words: [{ id: 1, location: '113:1:1', text: 'x' }] },
        { lineNumber: 4, type: 'surah_name', centered: true, surah: 114, words: [] },
        { lineNumber: 5, type: 'basmallah', centered: true, words: [] },
      ),
    ).lines;
    const specialIds = lines.filter((l) => l.type !== 'ayah').flatMap((l) => l.words.map((w) => w.id));
    expect(new Set(specialIds).size).toBe(4);
    specialIds.forEach((id) => expect(id).toBeLessThan(1));
    expect(lines[3].words[0].text).toBe('سُوْرَةُ الناس');
  });

  test('a surah_name Line without a valid surah number fails loudly', () => {
    expect(() =>
      withSpecialLineContent(page({ lineNumber: 1, type: 'surah_name', centered: true, surah: 115, words: [] })),
    ).toThrow(/surah 115/);
  });
});
