import { DEFAULT_TUNING, layoutPage, mushafFontSize, type Measure, type Page } from '@/layout';

// Ink 1.5 em, stretched 1.3× = 1.95 em of height per Line at 16 Lines per Page.
const mushaf = { inkHeightEm: 1.5, linesPerPage: 16, tuning: DEFAULT_TUNING };

describe('mushafFontSize', () => {
  test('in a tall, narrow text area the size is bound by the longest Line', () => {
    const size = mushafFontSize({
      ...mushaf,
      longestLineEmByPage: [10, 15, 12],
      textArea: { width: 300, height: 2000 },
    });
    expect(size).toBeCloseTo(20); // 300px ÷ 15 em
  });

  test('in a short, wide text area the size is bound by the height of the stretched ink', () => {
    const textArea = { width: 1000, height: 480 };
    const size = mushafFontSize({ ...mushaf, longestLineEmByPage: [10, 15, 12], textArea });
    expect(size).toBeCloseTo(30 / 1.95); // pitch 30px ÷ 1.95 em
    expect(size * 1.5 * 1.3 * 16).toBeLessThanOrEqual(480 + 1e-9);
  });

  test('the height bound follows the vertical stretch and Lines per Page', () => {
    const size = mushafFontSize({
      ...mushaf,
      linesPerPage: 15,
      tuning: { ...DEFAULT_TUNING, verticalStretch: 1 },
      longestLineEmByPage: [10],
      textArea: { width: 1000, height: 450 },
    });
    expect(size).toBeCloseTo(20); // pitch 30px ÷ 1.5 em
  });

  test('Lines longer than the width cut-off do not set the size', () => {
    const size = mushafFontSize({
      ...mushaf,
      longestLineEmByPage: [10, 15, 25, 12],
      textArea: { width: 300, height: 2000 },
    });
    expect(size).toBeCloseTo(20); // 300px ÷ 15 em; the 25 em Line is past the 18 em cut-off
  });

  test('the cut-off is read from the tuning', () => {
    const size = mushafFontSize({
      ...mushaf,
      tuning: { ...DEFAULT_TUNING, widthCutoffEm: 30 },
      longestLineEmByPage: [10, 15, 25, 12],
      textArea: { width: 300, height: 2000 },
    });
    expect(size).toBeCloseTo(12); // 300px ÷ 25 em
  });

  test('Pages within the cut-off share the Mushaf size; only a Page past it shrinks', () => {
    // Fake measurer: every character is half an em. Lines of 20, 30 and 50 chars are 10, 15 and 25 em.
    const measure: Measure = (text, fontSize) => text.length * 0.5 * fontSize;
    const pageWithLine = (n: number, chars: number): Page => ({
      layoutPageNumber: n,
      lines: [{ lineNumber: 1, type: 'ayah', centered: false, words: [
        { id: n * 10 + 1, location: `${n}:1:1`, text: 'a'.repeat(chars / 2) },
        { id: n * 10 + 2, location: `${n}:1:2`, text: 'b'.repeat(chars / 2) },
      ] }],
    });
    const pages = [pageWithLine(1, 20), pageWithLine(2, 30), pageWithLine(3, 50)];
    const textArea = { width: 300, height: 2000 };
    const fontSize = mushafFontSize({ ...mushaf, longestLineEmByPage: [10, 15, 25], textArea });
    const sizes = pages.map(
      (page) => layoutPage({ page, linesPerPage: 16, measure, textArea, fontSize, tuning: DEFAULT_TUNING }).fontSize,
    );
    expect(sizes[0]).toBeCloseTo(20);
    expect(sizes[1]).toBeCloseTo(20);
    expect(sizes[2]).toBeCloseTo(12); // 300px ÷ 25 em
  });

  test('Pages with no justified Line contribute nothing', () => {
    const size = mushafFontSize({ ...mushaf, longestLineEmByPage: [], textArea: { width: 300, height: 480 } });
    expect(size).toBeCloseTo(30 / 1.95);
  });
});
