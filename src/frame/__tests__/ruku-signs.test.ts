import type { PlacedLine } from '@/layout';

import { frameGeometry } from '../page-frame';
import { RUKU_SIGN_PARTS, rukuSignPlacements, rukuSigns, type LinePosition, type Ruku } from '../ruku-signs';

/** All 558 rukus from the QUL ruku metadata in the committed sandbox (quran-metadata/65). */
const QUL_RUKUS: Ruku[] = Object.values(
  require('../../../sandbox/qul/metadata/quran-metadata-ruku.json') as Record<
    string,
    { ruku_number: number; surah_ruku_number: number; verses_count: number; last_verse_key: string }
  >,
).map((r) => ({
  rukuNumber: r.ruku_number,
  surahRukuNumber: r.surah_ruku_number,
  ayahCount: r.verses_count,
  lastAyahKey: r.last_verse_key,
}));
/** A stand-in Mushaf Layout: every Ayah ends on a Line of its own, one Page per surah. */
const oneLinePerAyah = (ayahKey: string): LinePosition => {
  const [surah, ayah] = ayahKey.split(':').map(Number);
  return { pageNumber: surah, lineNumber: ayah };
};

describe('ruku signs from the ruku metadata', () => {
  const signs = rukuSigns(QUL_RUKUS, oneLinePerAyah);
  const signOf = (rukuNumber: number) => signs[rukuNumber - 1];

  test('every one of the 558 rukus gets a sign', () => {
    expect(signs).toHaveLength(558);
  });

  test('a ruku counts toward the Para it ends in: ruku 384 (36:13–32) starts in Para 22 but is Para 23’s 1st', () => {
    expect(signOf(383)).toMatchObject({ lineNumber: 12, inPara: 18 });
    expect(signOf(384)).toMatchObject({ lineNumber: 32, inPara: 1 });
  });

  test('ruku 386 is Ya-Sin’s 4th, 17 Ayahs, Para 23’s 3rd, on the Line holding 36:67', () => {
    expect(signOf(386)).toEqual({ pageNumber: 36, lineNumber: 67, inSurah: 4, ayahCount: 17, inPara: 3 });
  });

  test('the Para count restarts at 1 in each of the 30 Paras', () => {
    expect(signs.filter((s) => s.inPara === 1)).toHaveLength(30);
    expect(signOf(1).inPara).toBe(1);
  });

  test('rukus that close a surah keep their sign, from the first to the last Ayah of the Mushaf', () => {
    expect(signOf(1)).toEqual({ pageNumber: 1, lineNumber: 7, inSurah: 1, ayahCount: 7, inPara: 1 });
    expect(signOf(558)).toMatchObject({ pageNumber: 114, lineNumber: 6, inSurah: 1, ayahCount: 6 });
  });

  test('a ruku whose last Ayah is on no Line fails loudly', () => {
    const noLine = (key: string) => (key === '36:67' ? undefined : oneLinePerAyah(key));
    expect(() => rukuSigns(QUL_RUKUS, noLine)).toThrow(/386.*36:67/);
  });

  test('rukus out of order fail loudly: the Para count depends on it', () => {
    expect(() => rukuSigns([QUL_RUKUS[1], QUL_RUKUS[0]], oneLinePerAyah)).toThrow(/order/);
  });
});

describe('ruku sign placement in the margin column', () => {
  const frame = frameGeometry({ w: 393, h: 759 }, 'right');
  const line = (lineNumber: number, centerY: number): PlacedLine => ({
    lineNumber,
    type: 'ayah',
    scaleX: 1,
    scaleY: 1.3,
    centerY,
    words: [],
  });
  const lines = [line(11, 500), line(12, 540), line(13, 580)];
  const sign = { lineNumber: 12, inSurah: 4, ayahCount: 17, inPara: 3 };

  test('the ع sits in the middle of the margin column, level with its Line', () => {
    const [placed] = rukuSignPlacements([sign], lines, frame);
    const column = frame.marginColumn;
    expect(placed.letter.text).toBe('ع');
    expect(placed.letter.centerX).toBeCloseTo(column.x + column.w / 2);
    // Level with Line 12 (centre 540): nearer its centre than half the 40-unit Line pitch.
    expect(Math.abs(placed.letter.centerY - (frame.textArea.y + 540))).toBeLessThan(20 / 2);
  });

  test('number in surah above, Ayah count inside, number in Para below, in Urdu digits', () => {
    const [{ letter, above, inside, below }] = rukuSignPlacements([sign], lines, frame);
    expect([above.text, inside.text, below.text]).toEqual(['۴', '۱۷', '۳']);
    expect(above.centerY).toBeLessThan(letter.centerY);
    expect(below.centerY).toBeGreaterThan(letter.centerY);
    expect(inside.fontSize).toBeLessThan(letter.fontSize);
  });

  test('the whole sign stays inside the margin column', () => {
    const [placed] = rukuSignPlacements([sign], lines, frame);
    const column = frame.marginColumn;
    for (const part of RUKU_SIGN_PARTS.map((p) => placed[p])) {
      expect(part.centerX).toBeGreaterThan(column.x);
      expect(part.centerX).toBeLessThan(column.x + column.w);
      expect(part.fontSize).toBeLessThanOrEqual(placed.letter.fontSize);
    }
  });

  test('a sign for a Line not on the Page fails loudly', () => {
    expect(() => rukuSignPlacements([{ ...sign, lineNumber: 16 }], lines, frame)).toThrow(/Line 16/);
  });
});
