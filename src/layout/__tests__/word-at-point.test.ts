import { DEFAULT_TUNING, layoutPage, wordAtPoint, type Measure, type Page } from '@/layout';

/** Fake measurer: every character is half an em wide. */
const measure: Measure = (text, fontSize) => text.length * 0.5 * fontSize;

// Two Lines of 16 in a 300 × 480 area at 20px: pitch 30, centred from y = 210.
// Line 1 (justified, gap 0.5 em = 10px): 'aaaa' (40px) and 'bb' (20px) widened ×(290 / 60).
//   'aaaa' spans x 106.67..300, 'bb' spans x 0..96.67; the gap is 96.67..106.67.
// Line 2 (centred): 'cc' (20px) spans x 140..160.
const page: Page = {
  layoutPageNumber: 1,
  lines: [
    { lineNumber: 1, type: 'ayah', centered: false, words: [
      { id: 1, location: '1:1:1', text: 'aaaa' },
      { id: 2, location: '1:1:2', text: 'bb' },
    ] },
    { lineNumber: 2, type: 'ayah', centered: true, words: [{ id: 3, location: '1:2:1', text: 'cc' }] },
  ],
};
const layout = layoutPage({
  page,
  linesPerPage: 16,
  measure,
  textArea: { width: 300, height: 480 },
  fontSize: 20,
  tuning: { ...DEFAULT_TUNING, wordGapEm: 0.5 },
});

describe('wordAtPoint', () => {
  test.each([
    [250, 225, 1],
    [110, 212, 1],
    [50, 238, 2],
    [150, 255, 3],
  ])('(%d, %d) is on word %d', (x, y, id) => {
    expect(wordAtPoint(layout, x, y)?.id).toBe(id);
  });

  test.each([
    ['in the gap between two words', 100, 225],
    ['beside a centred Line', 50, 255],
    ['above the first Line of a centred Page', 150, 100],
    ['below the last Line', 150, 300],
    ['left of the text area', -5, 225],
    ['right of the text area', 305, 225],
  ])('a point %s is on no word', (_, x, y) => {
    expect(wordAtPoint(layout, x, y)).toBeNull();
  });
});
