// PROTOTYPE switcher: floating pill that cycles `?variant=`. Dev builds only.
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function PrototypeSwitcher({
  variants,
  current,
  bottom = 16,
}: {
  variants: { key: string; name: string }[];
  current: string;
  bottom?: number;
}) {
  if (!__DEV__) return null;
  const i = Math.max(0, variants.findIndex((v) => v.key === current));
  const go = (d: number) => router.setParams({ variant: variants[(i + d + variants.length) % variants.length].key });
  return (
    <View style={[styles.bar, { bottom }]} pointerEvents="box-none">
      <View style={styles.pill}>
        <Pressable onPress={() => go(-1)} hitSlop={12}>
          <Text style={styles.arrow}>←</Text>
        </Pressable>
        <Text style={styles.label}>
          {variants[i].key} ({variants[i].name})
        </Text>
        <Pressable onPress={() => go(1)} hitSlop={12}>
          <Text style={styles.arrow}>→</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#111',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  arrow: { color: '#fff', fontSize: 20, fontWeight: '700' },
  label: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
