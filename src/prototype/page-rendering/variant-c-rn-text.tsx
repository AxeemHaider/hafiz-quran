// PROTOTYPE (ticket #6). Variant C: RN <Text> per word, row-reverse + space-between per Line.
// RN has no synchronous text measure, so an invisible pass at 100pt collects widths via onLayout first.
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { isJustified, lineUnits } from './data';
import { fitPage, gapStats, now } from './layout';
import type { VariantProps } from './types';

type Measured = { widths: number[][]; space: number; lh: number };

// Remount per input so measurement state starts fresh (no reset effects).
export function VariantC(props: VariantProps) {
  const { page, font, W, H, rule } = props;
  return <Inner key={`${page.page}-${font}-${W}-${H}-${rule.minGap}-${rule.ink}`} {...props} />;
}

function Inner({ page, W, H, font, rule, stretch, showBoxes, selected, onSelect, onStats }: VariantProps) {
  const units = useMemo(() => page.lines.map(lineUnits), [page]);
  const justified = useMemo(() => page.lines.map(isJustified), [page]);
  const [m, setM] = useState<Measured | null>(null);
  const [t0] = useState(now);
  const raw = useRef(new Map<string, { w: number; h: number }>());
  const total = units.reduce((a, us) => a + us.length, 0) + 2;

  const record = (key: string, w: number, h: number) => {
    raw.current.set(key, { w, h });
    if (raw.current.size !== total) return;
    const g = (k: string) => raw.current.get(k)!;
    setM({
      widths: units.map((us) => us.map((u) => g(u.key).w)),
      space: g('__sp').w - g('__nosp').w,
      lh: g(units[0][0].key).h,
    });
  };

  const fit = m ? fitPage(m.widths, m.space, m.lh, W, H, rule) : null;

  // Actual gaps at the final size, from each word's onLayout x.
  const placed = useRef(new Map<string, { x: number; w: number }>());
  const [gapReport, setGapReport] = useState<{ gapMin: number; gapMax: number; overflow: boolean } | null>(null);
  const recordPlaced = (key: string, x: number, w: number) => {
    placed.current.set(key, { x, w });
    if (!fit || !m || placed.current.size !== total - 2) return;
    const space = (m.space * fit.size) / 100;
    const gaps = units.map((us) => {
      const ps = us.map((u) => placed.current.get(u.key)!);
      let min = Infinity;
      for (let i = 1; i < ps.length; i++) min = Math.min(min, ps[i - 1].x - (ps[i].x + ps[i].w));
      return ps.length > 1 ? min : space;
    });
    setGapReport({ ...gapStats(gaps, justified, space), overflow: gaps.some((x) => x < 0) });
  };

  useEffect(() => {
    if (fit && gapReport) onStats(page.page, { ...fit, ...gapReport, buildMs: now() - t0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gapReport]);

  const fam = { fontFamily: font };
  return (
    <View style={{ width: W, height: H }}>
      {!m && (
        <View style={styles.measure} pointerEvents="none">
          {units.flat().map((u) => (
            <Text
              key={u.key}
              style={[fam, { fontSize: 100 }]}
              onLayout={(e) => record(u.key, e.nativeEvent.layout.width, e.nativeEvent.layout.height)}>
              {u.text}
            </Text>
          ))}
          <Text style={[fam, { fontSize: 100 }]} onLayout={(e) => record('__sp', e.nativeEvent.layout.width, 0)}>
            ا ا
          </Text>
          <Text style={[fam, { fontSize: 100 }]} onLayout={(e) => record('__nosp', e.nativeEvent.layout.width, 0)}>
            اا
          </Text>
        </View>
      )}
      {fit &&
        units.map((us, i) => (
          <View
            key={i}
            style={[
              styles.line,
              {
                top: i * fit.pitch,
                height: fit.pitch,
                width: W,
                justifyContent: justified[i] ? 'space-between' : 'center',
                columnGap: justified[i] ? 0 : (m!.space * fit.size) / 100,
              },
            ]}>
            {us.map((u) => (
              <Text
                key={u.key}
                numberOfLines={1}
                onPress={() => onSelect(u)}
                onLayout={(e) => recordPlaced(u.key, e.nativeEvent.layout.x, e.nativeEvent.layout.width)}
                style={[
                  fam,
                  styles.word,
                  { fontSize: fit.size, transform: [{ scaleY: stretch }] },
                  u.key === selected && styles.selected,
                  showBoxes && styles.box,
                ]}>
                {u.text}
              </Text>
            ))}
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  measure: { position: 'absolute', left: -20000, top: 0, opacity: 0, alignItems: 'flex-start' },
  line: { position: 'absolute', left: 0, flexDirection: 'row-reverse', alignItems: 'center' },
  word: { flexShrink: 0, includeFontPadding: false, color: '#1a1a1a' },
  selected: { backgroundColor: '#f5d76e' },
  box: { borderWidth: 0.5, borderColor: '#e5484d' },
});
