import { pageBox } from '@/reader/page-box';

describe('pageBox', () => {
  test('on a phone the Page box is the whole safe area', () => {
    expect(pageBox({ width: 390, height: 780 }, 600)).toEqual({ x: 0, y: 0, w: 390, h: 780 });
  });

  test('on a large screen the width is capped and the box is centred, keeping the full height', () => {
    expect(pageBox({ width: 1000, height: 1300 }, 600)).toEqual({ x: 200, y: 0, w: 600, h: 1300 });
  });

  test('a screen exactly at the cap fills it', () => {
    expect(pageBox({ width: 600, height: 900 }, 600)).toEqual({ x: 0, y: 0, w: 600, h: 900 });
  });
});
