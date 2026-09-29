// PROTOTYPE (ticket #6). Variant A: Skia, one Canvas per Page, one Paragraph per word.
import {
  Canvas,
  Paragraph,
  Rect,
  Skia,
  TextDirection,
  type SkParagraph,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { Pressable } from 'react-native';

import { isJustified, lineUnits } from './data';
import { fitPage, gapStats, hit, now, placeLines } from './layout';
import type { VariantProps } from './types';

export const makePara = (
  fontMgr: SkTypefaceFontProvider,
  font: string,
  text: string,
  size: number,
  wordSpacing = 0,
): SkParagraph => {
  const p = Skia.ParagraphBuilder.Make({ textDirection: TextDirection.RTL }, fontMgr)
    .pushStyle({ fontFamilies: [font], fontSize: size, wordSpacing, color: Skia.Color('#1a1a1a') })
    .addText(text)
    .build();
  p.layout(100000);
  return p;
};
export const spaceWidth = (fontMgr: SkTypefaceFontProvider, font: string, size: number) =>
  makePara(fontMgr, font, 'ا ا', size).getMaxIntrinsicWidth() -
  makePara(fontMgr, font, 'اا', size).getMaxIntrinsicWidth();

export function VariantA({ page, W, H, font, fontMgr, rule, showBoxes, selected, onSelect, onStats }: VariantProps) {
  const built = useMemo(() => {
    const t0 = now();
    const units = page.lines.map(lineUnits);
    const justified = page.lines.map(isJustified);
    const widths100 = units.map((us) => us.map((u) => makePara(fontMgr, font, u.text, 100).getMaxIntrinsicWidth()));
    const lh100 = makePara(fontMgr, font, units[0][0].text, 100).getHeight();
    const fit = fitPage(widths100, spaceWidth(fontMgr, font, 100), lh100, W, H, rule);
    const paras = units.map((us) => us.map((u) => makePara(fontMgr, font, u.text, fit.size)));
    const widths = paras.map((ps) => ps.map((p) => p.getMaxIntrinsicWidth()));
    const space = spaceWidth(fontMgr, font, fit.size);
    const { boxes, gaps } = placeLines(widths, justified, space, W, fit.pitch);
    const lh = paras[0][0].getHeight();
    const stats = {
      ...fit,
      ...gapStats(gaps, justified, space),
      overflow: gaps.some((g) => g < 0),
      buildMs: now() - t0,
    };
    return { units, paras, boxes, lh, stats };
  }, [page, W, H, font, fontMgr, rule]);

  useEffect(() => onStats(page.page, built.stats), [built, onStats, page.page]);

  const { units, paras, boxes, lh, stats } = built;
  return (
    <Pressable
      onPress={(e) => {
        const h = hit(boxes, e.nativeEvent.locationX, e.nativeEvent.locationY);
        onSelect(h ? units[h[0]][h[1]] : null);
      }}>
      <Canvas style={{ width: W, height: H }}>
        {boxes.flatMap((row, i) =>
          row.map((b, j) => {
            const u = units[i][j];
            const sel = u.key === selected;
            return [
              sel || showBoxes ? (
                <Rect
                  key={`r${u.key}`}
                  x={b.x}
                  y={b.y}
                  width={b.w}
                  height={b.h}
                  color={sel ? '#f5d76e' : '#e5484d'}
                  style={sel ? 'fill' : 'stroke'}
                  strokeWidth={0.5}
                />
              ) : null,
              <Paragraph
                key={u.key}
                paragraph={paras[i][j]}
                // RTL paragraphs right-align inside their layout width; pin the right edge to the box.
                x={b.x + b.w - (Math.ceil(b.w) + 2)}
                y={b.y + (stats.pitch - lh) / 2}
                width={Math.ceil(b.w) + 2}
              />,
            ];
          }),
        )}
      </Canvas>
    </Pressable>
  );
}
