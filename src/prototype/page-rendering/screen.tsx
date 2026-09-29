// PROTOTYPE (wayfinder ticket #6): three page-rendering approaches, switched via ?variant=A|B|C.
// Throwaway — lives only on the prototype/page-rendering branch.
import { useFonts as useSkiaFonts } from '@shopify/react-native-skia';
import { useFonts } from 'expo-font';
import { useIsFocused, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrototypeSwitcher } from '@/components/prototype-switcher';
import { FONT_NAMES, FONT_SOURCES, PAGES, SKIA_FONT_SOURCES, REFERENCE_IMAGE, type FontName, type Unit } from '@/prototype/page-rendering/data';
import type { Stats } from '@/prototype/page-rendering/layout';
import { VariantA } from '@/prototype/page-rendering/variant-a-skia-per-word';
import { VariantB } from '@/prototype/page-rendering/variant-b-skia-per-line';
import { VariantC } from '@/prototype/page-rendering/variant-c-rn-text';

const VARIANTS = [
  { key: 'A', name: 'Skia per word', C: VariantA },
  { key: 'B', name: 'Skia per Line + wordSpacing', C: VariantB },
  { key: 'C', name: 'RN Text per word', C: VariantC },
];
// Simulated screens (dp). "device" uses the real safe area. Others are drawn at that size, scaled to fit.
const PRESETS = { device: null, '360×640': [360, 640], '430×932': [430, 932], '820×1180 tab': [820, 1180] } as const;
type Preset = keyof typeof PRESETS;
const MARGIN = 8; // stand-in for the Page Frame, which this ticket doesn't design
const ORDER = [...PAGES].reverse(); // RTL: next page sits to the left
const START = ORDER.findIndex((p) => p.page === 400);

const cycle = <T,>(xs: readonly T[], x: T) => xs[(xs.indexOf(x) + 1) % xs.length];

export default function PrototypePageRendering() {
  const { variant = 'A' } = useLocalSearchParams<{ variant?: string }>();
  const V = (VARIANTS.find((v) => v.key === variant) ?? VARIANTS[0]).C;
  const fontMgr = useSkiaFonts(SKIA_FONT_SOURCES);
  const [rnFontsLoaded] = useFonts(FONT_SOURCES);
  const win = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Native tabs mount every tab at startup; only cover the screen while this tab is focused.
  const focused = useIsFocused();

  const [font, setFont] = useState<FontName>('HanafiNormal');
  const [preset, setPreset] = useState<Preset>('device');
  const [minGap, setMinGap] = useState(0.25);
  const [ink, setInk] = useState(true);
  const rule = useMemo(() => ({ minGap, ink }), [minGap, ink]);
  const [showBoxes, setShowBoxes] = useState(false);
  const [reference, setReference] = useState(false);
  const [hud, setHud] = useState(true);
  const [selected, setSelected] = useState<Unit | null>(null);
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [current, setCurrent] = useState(400);
  const onStats = useCallback(
    (page: number, s: Stats) => setStats((prev) => ({ ...prev, [`${variant}-${font}-${page}`]: s })),
    [variant, font],
  );

  const availW = win.width;
  const availH = win.height - insets.top - insets.bottom;
  const dims = PRESETS[preset];
  const box = dims ? { w: dims[0], h: dims[1] } : { w: availW, h: availH };
  const scale = Math.min(1, availW / box.w, availH / box.h);
  const W = box.w - 2 * MARGIN;
  const H = box.h - 2 * MARGIN;

  const viewable = useCallback(({ viewableItems }: { viewableItems: { item: (typeof PAGES)[number] }[] }) => {
    if (viewableItems[0]) setCurrent(viewableItems[0].item.page);
  }, []);

  const s = stats[`${variant}-${font}-${current}`];
  const ready = fontMgr && rnFontsLoaded;

  // Full-screen Modal so the tab bar doesn't eat Page height.
  return (
    <Modal visible={focused} animationType="none" presentationStyle="fullScreen" statusBarTranslucent>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {ready ? (
          <FlatList
            key={`${variant}-${preset}`}
            horizontal
            pagingEnabled
            data={ORDER}
            keyExtractor={(p) => String(p.page)}
            initialScrollIndex={START}
            getItemLayout={(_, i) => ({ length: availW, offset: availW * i, index: i })}
            windowSize={3}
            initialNumToRender={1}
            onViewableItemsChanged={viewable}
            viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={{ width: availW, height: availH, alignItems: 'center', justifyContent: 'center' }}>
                <View style={[styles.page, { width: box.w, height: box.h, padding: MARGIN, transform: [{ scale }] }]}>
                  {reference && item.page === 400 ? (
                    <Image source={REFERENCE_IMAGE} style={{ width: W, height: H }} resizeMode="contain" />
                  ) : (
                    <V
                      page={item}
                      W={W}
                      H={H}
                      font={font}
                      fontMgr={fontMgr}
                      rule={rule}
                      showBoxes={showBoxes}
                      selected={selected?.key ?? null}
                      onSelect={setSelected}
                      onStats={onStats}
                    />
                  )}
                </View>
              </View>
            )}
          />
        ) : (
          <Text style={styles.loading}>loading fonts…</Text>
        )}

        {hud && (
          <View style={[styles.hud, { top: insets.top + 4 }]}>
            <View style={styles.row}>
              <Chip label={font.replace('Hanafi', '')} onPress={() => setFont(cycle(FONT_NAMES, font))} />
              <Chip label={preset} onPress={() => setPreset(cycle(Object.keys(PRESETS) as Preset[], preset))} />
              <Chip label={`gap ≥${minGap}×`} onPress={() => setMinGap(cycle([1, 0.5, 0.25, 0], minGap))} />
              <Chip label={ink ? 'fit ink' : 'fit line-height'} onPress={() => setInk(!ink)} />
              <Chip label={showBoxes ? 'boxes' : 'no boxes'} onPress={() => setShowBoxes(!showBoxes)} />
              <Chip label={reference ? 'REF' : 'ref'} onPress={() => setReference(!reference)} />
              <Chip label="✕" onPress={() => setHud(false)} />
            </View>
            <Text style={styles.stats}>
              p{current} (print {current + 1}) · {W.toFixed(0)}×{H.toFixed(0)}dp
              {s
                ? ` · size ${s.size} (${s.bind}; w ${s.widthSize.toFixed(1)} h ${s.heightSize.toFixed(1)}) · gap ${s.gapMin.toFixed(2)}–${s.gapMax.toFixed(2)}× space${s.overflow ? ' · OVERFLOW' : ''} · build ${s.buildMs.toFixed(0)}ms`
                : ' · measuring…'}
            </Text>
            {selected && (
              <Text style={styles.stats}>
                tapped {selected.loc} {selected.loc.includes(':') ? `(ayah ${selected.loc.split(':').slice(0, 2).join(':')})` : ''} ·{' '}
                {selected.text}
              </Text>
            )}
          </View>
        )}
        {!hud && <Pressable style={[styles.hudToggle, { top: insets.top }]} onPress={() => setHud(true)} />}
        <PrototypeSwitcher variants={VARIANTS} current={variant} bottom={insets.bottom + 8} />
      </View>
    </Modal>
  );
}

function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#e9e4d4' },
  page: { backgroundColor: '#fdfaf0' },
  loading: { margin: 40, textAlign: 'center' },
  hud: { position: 'absolute', left: 6, right: 6, gap: 3 },
  hudToggle: { position: 'absolute', left: 0, width: 40, height: 40 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  chip: { backgroundColor: 'rgba(17,17,17,0.85)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  chipText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  stats: { backgroundColor: 'rgba(17,17,17,0.75)', color: '#fff', fontSize: 10, padding: 4, borderRadius: 6, overflow: 'hidden' },
});
