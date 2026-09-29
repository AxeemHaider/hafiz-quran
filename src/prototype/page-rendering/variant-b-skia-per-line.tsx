// PROTOTYPE (ticket #6). Variant B: Skia, one Canvas per Page, one Paragraph per Line, slack via wordSpacing.
import { Canvas, Group, Paragraph, Rect } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { Pressable } from 'react-native';

import { isJustified, lineUnits } from './data';
import { fitPage, gapStats, hit, now, type Box } from './layout';
import type { VariantProps } from './types';
import { makePara, spaceWidth } from './variant-a-skia-per-word';

export function VariantB({ page, W, H, font, fontMgr, rule, stretch, showBoxes, selected, onSelect, onStats }: VariantProps) {
  const built = useMemo(() => {
    const t0 = now();
    const units = page.lines.map(lineUnits);
    const justified = page.lines.map(isJustified);
    const texts = units.map((us) => us.map((u) => u.text).join(' '));
    // Fit uses whole-Line natural widths (as one "word" so fitPage adds no spaces), shrunk to minGap spaces.
    const space100 = spaceWidth(fontMgr, font, 100);
    const lines100 = texts.map((t) => [
      makePara(fontMgr, font, t, 100).getMaxIntrinsicWidth() - (1 - rule.minGap) * space100 * (t.split(' ').length - 1),
    ]);
    const lh100 = makePara(fontMgr, font, texts[0], 100).getHeight();
    const fit = fitPage(lines100, 0, lh100, W, H, rule);
    const space = spaceWidth(fontMgr, font, fit.size);
    const gaps: number[] = [];
    const lines = texts.map((t, i) => {
      // Spaces inside a word (e.g. "سَلٰمٌ ۫") also get stretched: a known weakness of this variant.
      const spaces = t.split(' ').length - 1;
      const natural = makePara(fontMgr, font, t, fit.size).getMaxIntrinsicWidth();
      // widen: shrink spaces to minGap, then scale the whole Line sideways to fill W.
      const widen = rule.widen && justified[i] && spaces > 0;
      const extra = widen ? (rule.minGap - 1) * space : justified[i] && spaces > 0 ? (W - natural) / spaces : 0;
      const p = makePara(fontMgr, font, t, fit.size, extra);
      const width = p.getLongestLine();
      const sx = widen ? W / width : 1;
      gaps.push((space + extra) * sx);
      // RTL: the line right-aligns inside layout width lw; x is where the paragraph box starts.
      const lw = Math.ceil(width) + 2;
      p.layout(lw);
      const x = (justified[i] ? W : (W + width) / 2) - lw;
      let off = 0;
      const boxes: Box[] = units[i].map((u) => {
        const rs = p.getRectsForRange(off, off + u.text.length);
        off += u.text.length + 1;
        const l = Math.min(...rs.map((r) => r.x));
        const r = Math.max(...rs.map((r) => r.x + r.width));
        // Map through the widen scale, which is anchored at the Line's right edge (W).
        return { x: W - (W - (x + l)) * sx, y: i * fit.pitch, w: (r - l) * sx, h: fit.pitch };
      });
      return { p, x, lw, sx, boxes };
    });
    const lh = lines[0].p.getHeight();
    const stats = {
      ...fit,
      ...gapStats(gaps, justified, space),
      overflow: gaps.some((g) => g < 0),
      sxMax: Math.max(...lines.map((l) => l.sx)),
      buildMs: now() - t0,
    };
    return { units, lines, lh, stats };
  }, [page, W, H, font, fontMgr, rule]);

  useEffect(() => onStats(page.page, built.stats), [built, onStats, page.page]);

  const { units, lines, lh, stats } = built;
  const boxes = lines.map((l) => l.boxes);
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
            return sel || showBoxes ? (
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
            ) : null;
          }),
        )}
        {lines.map((l, i) => (
          // Stretch around the Line's vertical centre.
          <Group
            key={i}
            origin={{ x: W, y: (i + 0.5) * stats.pitch }}
            transform={[{ scaleX: l.sx }, { scaleY: stretch }]}>
            <Paragraph paragraph={l.p} x={l.x} y={i * stats.pitch + (stats.pitch - lh) / 2} width={l.lw} />
          </Group>
        ))}
      </Canvas>
    </Pressable>
  );
}
