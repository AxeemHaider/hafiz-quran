import { DEFAULT_TUNING, layoutPage, type Line, type Measure, type Page } from '@/layout';

/** Fake measurer: every character is half an em wide. */
const measure: Measure = (text, fontSize) => text.length * 0.5 * fontSize;

let nextId = 1;
const words = (...texts: string[]) =>
  texts.map((text) => {
    const id = nextId++;
    return { id, location: `1:1:${id}`, text };
  });
const ayah = (lineNumber: number, ...texts: string[]): Line => ({
  lineNumber,
  type: 'ayah',
  centered: false,
  words: words(...texts),
});
const page = (...lines: Line[]): Page => ({ layoutPageNumber: 1, lines });

const area = { width: 300, height: 480 };
const base = { linesPerPage: 16, measure, textArea: area, fontSize: 20, tuning: DEFAULT_TUNING };

describe('layoutPage', () => {
  test('Line Fidelity: every word appears exactly once, in its original Line and order', () => {
    const input = page(
      { lineNumber: 1, type: 'surah_name', centered: true, surah: 2, words: words('sss') },
      { lineNumber: 2, type: 'basmallah', centered: true, words: words('b', 'bb', 'bbb') },
      ayah(3, 'a', 'aa', 'aaa', 'aaaa'),
      ayah(4, 'a'.repeat(40), 'b'.repeat(40)), // overflows: the Page shrinks, words stay put
      { lineNumber: 5, type: 'ayah', centered: true, words: words('cc', 'c') },
    );
    const layout = layoutPage({ ...base, page: input });
    expect(layout.lines.map((l) => [l.lineNumber, l.type, l.words.map((w) => [w.id, w.location, w.text])])).toEqual(
      input.lines.map((l) => [l.lineNumber, l.type, l.words.map((w) => [w.id, w.location, w.text])]),
    );
  });

  test('a synthetic 15-Lines-per-Page Mushaf lays out with the same rules', () => {
    const lines = Array.from({ length: 15 }, (_, i) => ayah(i + 1, 'aaaa', 'bb', 'c'));
    const layout = layoutPage({ ...base, linesPerPage: 15, page: page(...lines) });
    expect(layout.pitch).toBe(32);
    expect(layout.offsetY).toBe(0);
    const last = layout.lines[14];
    expect(last.centerY).toBe(464);
    expect(last.words[0].box.x + last.words[0].box.w).toBeCloseTo(300);
    expect(last.words[2].box.x).toBeCloseTo(0);
  });

  test('a justified Line spans the text-area width edge to edge', () => {
    const layout = layoutPage({ ...base, page: page(ayah(1, 'aaaa', 'bb', 'cccccc')) });
    const [first, , last] = layout.lines[0].words;
    expect(first.box.x + first.box.w).toBeCloseTo(300);
    expect(last.box.x).toBeCloseTo(0);
  });

  test('a short justified Line is filled by widening its words, keeping the tuning gap', () => {
    // Two 20px words (2 chars × 0.5 em × 20px) with a 5px gap (0.25 em) must fill 300px: scale = 295 / 40.
    const tuning = { ...DEFAULT_TUNING, wordGapEm: 0.25 };
    const layout = layoutPage({ ...base, tuning, page: page(ayah(1, 'aa', 'bb')) });
    const line = layout.lines[0];
    const [right, left] = line.words;
    expect(line.scaleX).toBeCloseTo(7.375);
    expect(right.box.x - (left.box.x + left.box.w)).toBeCloseTo(5);
    expect(right.box.x + right.box.w).toBeCloseTo(300);
    expect(left.box.x).toBeCloseTo(0);
  });

  test.each<[string, Line]>([
    ['a centred ayah Line', { lineNumber: 1, type: 'ayah', centered: true, words: words('aaaa', 'bb') }],
    ['a surah_name Line', { lineNumber: 1, type: 'surah_name', centered: true, surah: 2, words: words('aaaa', 'bb') }],
    ['a basmallah Line', { lineNumber: 1, type: 'basmallah', centered: false, words: words('aaaa', 'bb') }],
    ['a single-word ayah Line', { lineNumber: 1, type: 'ayah', centered: false, words: words('aaaaaa') }],
  ])('%s keeps its natural width and is centred', (_, line) => {
    // 60px of words in a 300px area: from x = 120 to x = 180.
    const layout = layoutPage({ ...base, page: page(line) });
    const placed = layout.lines[0];
    const right = placed.words[0];
    const left = placed.words[placed.words.length - 1];
    expect(placed.scaleX).toBe(1);
    expect(right.box.x + right.box.w).toBeCloseTo(180);
    expect(left.box.x).toBeCloseTo(120);
  });

  test('a centred Line wider than the text area shrinks to fit', () => {
    // Two 20-char words × 10px = 400px in a 300px area.
    const line: Line = { lineNumber: 1, type: 'basmallah', centered: true, words: words('a'.repeat(20), 'b'.repeat(20)) };
    const placed = layoutPage({ ...base, page: page(line) }).lines[0];
    expect(placed.scaleX).toBeCloseTo(0.75);
    expect(placed.words[0].box.x + placed.words[0].box.w).toBeCloseTo(300);
    expect(placed.words[1].box.x).toBeCloseTo(0);
  });

  test('a Page whose Lines fit keeps the Mushaf font size', () => {
    const layout = layoutPage({ ...base, page: page(ayah(1, 'aaaa', 'bb'), ayah(2, 'aaaaaa', 'bbbbbb')) });
    expect(layout.fontSize).toBe(20);
  });

  test('a Page whose measured Line overflows at the Mushaf size shrinks until it fits', () => {
    // 40 + 40 chars with a 0.5 em gap at 20px = 800 + 10 = 810px; fits 300px at 20 × 300 / 810.
    const tuning = { ...DEFAULT_TUNING, wordGapEm: 0.5 };
    const layout = layoutPage({
      ...base,
      tuning,
      page: page(ayah(1, 'aaaa', 'bb'), ayah(2, 'a'.repeat(40), 'b'.repeat(40))),
    });
    expect(layout.fontSize).toBeCloseTo((20 * 300) / 810);
    const long = layout.lines[1];
    expect(long.scaleX).toBeCloseTo(1);
  });

  test('a Page shrinks to fit even when the measurer is not linear in font size', () => {
    // Real shapers round and hint: widths don't scale exactly with size.
    const lumpy: Measure = (text, fontSize) => Math.ceil(text.length * 0.5 * fontSize) + 3;
    const layout = layoutPage({ ...base, measure: lumpy, page: page(ayah(1, 'a'.repeat(40), 'b'.repeat(40))) });
    const [right, left] = layout.lines[0].words;
    expect(lumpy(right.text, layout.fontSize) + lumpy(left.text, layout.fontSize)).toBeLessThanOrEqual(300);
    expect(layout.fontSize).toBeGreaterThan(7);
  });

  test('a full Page puts one Line per pitch from the top of the text area', () => {
    const lines = Array.from({ length: 16 }, (_, i) => ayah(i + 1, 'aaaa', 'bb'));
    const layout = layoutPage({ ...base, page: page(...lines) });
    expect(layout.pitch).toBe(30);
    expect(layout.lines.map((l) => l.words[0].box.y)).toEqual(Array.from({ length: 16 }, (_, i) => i * 30));
    expect(layout.lines[15].words[1].box).toMatchObject({ y: 450, h: 30 });
  });

  test('a Page with fewer Lines than Lines per Page is centred vertically at the Mushaf pitch and size', () => {
    // 4 Lines × 30px = 120px in 480px: starts at 180.
    const layout = layoutPage({ ...base, page: page(ayah(1, 'aa', 'bb'), ayah(2, 'aa', 'bb'), ayah(3, 'aa', 'bb'), ayah(4, 'aa', 'bb')) });
    expect(layout.fontSize).toBe(20);
    expect(layout.pitch).toBe(30);
    expect(layout.lines.map((l) => l.words[0].box.y)).toEqual([180, 210, 240, 270]);
  });

  test('words are stretched vertically by the tuning around their Line centre', () => {
    const tuning = { ...DEFAULT_TUNING, verticalStretch: 1.5 };
    const layout = layoutPage({ ...base, tuning, page: page(ayah(1, 'aa', 'bb'), ayah(2, 'aa', 'bb')) });
    expect(layout.lines.map((l) => [l.scaleY, l.centerY])).toEqual([
      [1.5, 225],
      [1.5, 255],
    ]);
  });

  test('each word carries its unscaled measured width and the right edge its widening is pinned to', () => {
    const layout = layoutPage({ ...base, page: page(ayah(1, 'aaaa', 'bb')) });
    const [right, left] = layout.lines[0].words;
    // 40px and 20px words widened ×5 to fill 300px.
    expect(right).toMatchObject({ measuredWidth: 40, anchorX: 300, box: { x: 100, w: 200 } });
    expect(left).toMatchObject({ measuredWidth: 20, anchorX: 100, box: { x: 0, w: 100 } });
  });

  test('changing the vertical stretch changes no word’s x position or width', () => {
    const p = page(ayah(1, 'aaaa', 'bb', 'c'), { lineNumber: 2, type: 'basmallah', centered: true, words: words('ddd') });
    const xs = (verticalStretch: number) =>
      layoutPage({ ...base, page: p, tuning: { ...DEFAULT_TUNING, verticalStretch } }).lines.flatMap((l) =>
        l.words.map((w) => [w.box.x, w.box.w, w.anchorX, w.measuredWidth]),
      );
    expect(xs(1)).toEqual(xs(1.3));
    expect(xs(1)).toEqual(xs(2));
  });
});
