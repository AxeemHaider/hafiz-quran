import type { Box, Line, Page, PageLayout, PlacedLine } from '@/layout';

import { frameGeometry, lineRuleYs, pageHeader } from '../page-frame';

const inside = (inner: Box, outer: Box) =>
  inner.x > outer.x && inner.y > outer.y && inner.x + inner.w < outer.x + outer.w && inner.y + inner.h < outer.y + outer.h;
const right = (b: Box) => b.x + b.w;
const bottom = (b: Box) => b.y + b.h;

describe('Page Frame geometry', () => {
  const phone = { w: 393, h: 759 };
  const frame = frameGeometry(phone);

  test('the text area sits inside a double-rule border, inside the Page box', () => {
    const page = { x: -1, y: -1, w: phone.w + 2, h: phone.h + 2 };
    expect(inside(frame.textArea, frame.innerBorder)).toBe(true);
    expect(inside(frame.innerBorder, frame.outerBorder)).toBe(true);
    expect(inside(frame.outerBorder, page)).toBe(true);
  });

  test('the header strip runs across the top, above the border', () => {
    expect(frame.header.y).toBe(0);
    expect(bottom(frame.header)).toBeLessThanOrEqual(frame.outerBorder.y);
    expect(frame.header.x).toBeLessThanOrEqual(frame.outerBorder.x);
    expect(right(frame.header)).toBeGreaterThanOrEqual(right(frame.outerBorder));
  });

  test('an empty margin column runs down the right-hand side, outside the border', () => {
    expect(frame.marginColumn.w).toBeGreaterThan(0);
    expect(frame.marginColumn.x).toBeGreaterThanOrEqual(right(frame.outerBorder));
    expect(right(frame.marginColumn)).toBeLessThanOrEqual(phone.w);
    expect(frame.marginColumn.y).toBe(frame.outerBorder.y);
    expect(frame.marginColumn.h).toBe(frame.outerBorder.h);
  });

  test('the Lines keep most of the Page', () => {
    expect(frame.textArea.w / phone.w).toBeGreaterThan(0.8);
    expect(frame.textArea.h / phone.h).toBeGreaterThan(0.85);
  });

  test('every frame size is a proportion of the Page box', () => {
    const doubled = frameGeometry({ w: phone.w * 2, h: phone.h * 2 });
    const twice = (b: Box) => ({ x: b.x * 2, y: b.y * 2, w: b.w * 2, h: b.h * 2 });
    for (const key of ['header', 'outerBorder', 'innerBorder', 'marginColumn', 'textArea'] as const) {
      const expected = twice(frame[key]);
      for (const side of ['x', 'y', 'w', 'h'] as const) expect(doubled[key][side]).toBeCloseTo(expected[side]);
    }
    expect(doubled.ruleWidths.outer).toBeCloseTo(frame.ruleWidths.outer * 2);
  });
});

describe('rules under Lines', () => {
  const line = (lineNumber: number, centerY: number): PlacedLine => ({
    lineNumber,
    type: 'ayah',
    scaleX: 1,
    scaleY: 1.3,
    centerY,
    words: [],
  });

  test('on a full Page a thin rule runs under each Line, except the last, which sits on the border', () => {
    const layout: PageLayout = { fontSize: 20, pitch: 40, offsetY: 0, lines: [line(1, 20), line(2, 60), line(3, 100)] };
    expect(lineRuleYs(layout)).toEqual([40, 80]);
  });

  test('a short, vertically centred Page gets a rule under every one of its Lines, the last included', () => {
    const layout: PageLayout = { fontSize: 20, pitch: 40, offsetY: 100, lines: [line(1, 120), line(2, 160)] };
    expect(lineRuleYs(layout)).toEqual([140, 180]);
  });
});

describe('Page Frame header', () => {
  const ayah = (lineNumber: number, ...locations: string[]): Line => ({
    lineNumber,
    type: 'ayah',
    centered: false,
    words: locations.map((location, i) => ({ id: lineNumber * 100 + i, location, text: 'x' })),
  });

  test("shows the surah and Para of the Page's first word, and the printed page number, in Urdu digits", () => {
    const page: Page = { layoutPageNumber: 400, lines: [ayah(1, '36:54:1', '36:54:2'), ayah(2, '36:55:1')] };
    expect(pageHeader(page, 401)).toEqual({ surah: 'يس ۳۶', pageNumber: '۴۰۱', para: 'وما لی ۲۳' });
  });

  test('skips surah-name and basmallah Lines: the surah is that of the first ayah word', () => {
    const page: Page = {
      layoutPageNumber: 1,
      lines: [
        { lineNumber: 1, type: 'surah_name', centered: true, surah: 78, words: [{ id: -1, location: '', text: 'x' }] },
        { lineNumber: 2, type: 'basmallah', centered: true, words: [{ id: -2, location: '', text: 'x' }] },
        ayah(3, '78:1:1'),
      ],
    };
    expect(pageHeader(page, 2)).toMatchObject({ surah: 'النبأ ۷۸', para: 'عم ۳۰' });
  });

  test('a Page without any ayah word fails loudly', () => {
    expect(() => pageHeader({ layoutPageNumber: 3, lines: [] }, 4)).toThrow(/no ayah word/);
  });
});
