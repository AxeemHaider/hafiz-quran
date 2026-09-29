// PROTOTYPE (ticket #6). Rough Page Frame modelled on docs/QuranPage.jpg, only so variants can be
// compared against the reference: header strip, double border, a rule under every Line, and an
// empty right margin column (where the Taj print puts waqf notes and ruku marks).
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LINES_PER_PAGE, type FontName, type Page } from './data';

const HEADER = 26;
const MARGIN_RIGHT = 18; // margin-notes column
const MARGIN_LEFT = 3;
const MARGIN_BOTTOM = 3;
const OUTER = 2;
const GAP = 2;
const INNER = 1;
const PAD = 1;
const BORDER = OUTER + GAP + INNER + PAD;

/** Size of the text area (where the 16 Lines go) inside a frame of w × h. */
export const frameInner = (w: number, h: number) => ({
  W: w - MARGIN_LEFT - MARGIN_RIGHT - 2 * BORDER,
  H: h - HEADER - MARGIN_BOTTOM - 2 * BORDER,
});

const DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const urdu = (n: number) => String(n).replace(/\d/g, (d) => DIGITS[+d]);
const SURAH: Record<number, string> = { 36: 'یٰسٓ', 37: 'الصّٰفّٰت' };

export function PageFrame({ page, w, h, font, children }: { page: Page; w: number; h: number; font: FontName; children: ReactNode }) {
  const surah = Number(page.lines.find((l) => l.words.length)?.words[0].loc.split(':')[0]);
  const { H } = frameInner(w, h);
  const pitch = H / LINES_PER_PAGE;
  const head = [styles.head, { fontFamily: font }];
  return (
    <View style={{ width: w, height: h }}>
      {/* RTL header: para on the right, page number centred, surah on the left (as printed). */}
      <View style={[styles.header, { left: MARGIN_LEFT, right: MARGIN_RIGHT }]}>
        <Text style={head}>
          {SURAH[surah] ?? surah} {urdu(surah)}
        </Text>
        <Text style={head}>{urdu(page.page + 1)}</Text>
        <Text style={head}>ومالی {urdu(23)}</Text>
      </View>
      <View style={[styles.outer, { left: MARGIN_LEFT, right: MARGIN_RIGHT }]}>
        <View style={styles.inner}>
          {Array.from({ length: LINES_PER_PAGE - 1 }, (_, i) => (
            <View key={i} style={[styles.rule, { top: (i + 1) * pitch }]} />
          ))}
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    height: HEADER,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  head: { fontSize: 13, color: '#1a1a1a', includeFontPadding: false },
  outer: { position: 'absolute', top: HEADER, bottom: MARGIN_BOTTOM, borderWidth: OUTER, borderColor: '#1a1a1a', padding: GAP },
  inner: { flex: 1, borderWidth: INNER, borderColor: '#1a1a1a', padding: PAD },
  rule: { position: 'absolute', left: PAD, right: PAD, height: StyleSheet.hairlineWidth * 2, backgroundColor: '#1a1a1a' },
});
