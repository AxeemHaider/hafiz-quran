/** PROTOTYPE (throwaway): floating bar that cycles the reader's ?variant= param. Dev builds only. */
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export const VARIANTS = [
  { key: 'corner', label: 'A · corner fold' },
  { key: 'straight', label: 'B · straight fold' },
  { key: 'slide', label: 'C · flat slide (today)' },
] as const;
export type VariantKey = (typeof VARIANTS)[number]['key'];

export const variantOf = (param: string | undefined): VariantKey =>
  VARIANTS.find((v) => v.key === param)?.key ?? 'corner';

export function VariantSwitcher({ current }: { current: VariantKey }) {
  if (!__DEV__) return null;
  const i = VARIANTS.findIndex((v) => v.key === current);
  const go = (step: number) =>
    router.setParams({ variant: VARIANTS[(i + step + VARIANTS.length) % VARIANTS.length].key });
  return (
    <View style={styles.bar} pointerEvents="box-none">
      <View style={styles.pill}>
        <Pressable onPress={() => go(-1)} hitSlop={12}>
          <Text style={styles.arrow}>◀</Text>
        </Pressable>
        <Text style={styles.label}>{VARIANTS[i].label}</Text>
        <Pressable onPress={() => go(1)} hitSlop={12}>
          <Text style={styles.arrow}>▶</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, bottom: 16, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#222',
    elevation: 6,
  },
  arrow: { color: '#fff', fontSize: 18 },
  label: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
