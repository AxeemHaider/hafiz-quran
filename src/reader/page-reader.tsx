import { useFonts } from '@shopify/react-native-skia';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Size } from '@/layout';
import { DATA_PREP_COMMAND, MUSHAF_ASSETS } from '@/mushaf/generated-assets';
import { MUSHAF_DB_NAME, readMushafInfo } from '@/mushaf/mushaf-data';
import { layoutFromPrinted, printedFromLayout } from '@/mushaf/page-number';

import { PagePager } from './page-pager';
import { MUSHAF_FONT_FAMILY, makeSkiaMeasure } from './skia-text';

/** The Page reader, opened at a printed page number. The Page is drawn dark on light whatever the theme. */
export function PageReader({ printedPage }: { printedPage: number }) {
  const [dbError, setDbError] = useState<Error | null>(null);
  let content;
  if ('missing' in MUSHAF_ASSETS) {
    content = (
      <Message
        title="Mushaf data not found"
        body={`Missing ${MUSHAF_ASSETS.missing.join(' and ')} in assets/generated/mushaf/. Run \`${DATA_PREP_COMMAND}\` (see sandbox/qul/README.md), then restart Metro with \`npx expo start -c\`.`}
      />
    );
  } else if (dbError) {
    content = <Message title="Could not open the Mushaf data" body={dbError.message} />;
  } else {
    content = (
      <SQLiteProvider
        databaseName={MUSHAF_DB_NAME}
        // Always overwrite: after data prep re-runs (e.g. a font swap) the device must not keep a stale copy.
        assetSource={{ assetId: MUSHAF_ASSETS.db, forceOverwrite: true }}
        onError={setDbError}>
        <LoadedReader printedPage={printedPage} font={MUSHAF_ASSETS.font} />
      </SQLiteProvider>
    );
  }
  return <SafeAreaView style={styles.screen}>{content}</SafeAreaView>;
}

function LoadedReader({ printedPage, font }: { printedPage: number; font: number }) {
  const db = useSQLiteContext();
  const fontMgr = useFonts({ [MUSHAF_FONT_FAMILY]: [font] });
  const info = useMemo(() => readMushafInfo(db), [db]);
  const measure = useMemo(() => (fontMgr ? makeSkiaMeasure(fontMgr) : null), [fontMgr]);
  const [available, setAvailable] = useState<Size | null>(null);

  const layoutPageNumber = layoutFromPrinted(printedPage);
  const inRange = Number.isInteger(layoutPageNumber) && layoutPageNumber >= 1 && layoutPageNumber <= info.pageCount;

  // Keep the route's printed page number in step with the Page on screen.
  const onPageChange = useCallback(
    (page: number) => router.setParams({ page: String(printedFromLayout(page)) }),
    [],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== available?.width || height !== available?.height) setAvailable({ width, height });
  };

  if (!inRange) {
    return <Message title="No such Page" body={`Printed page ${printedPage} is not in this Mushaf.`} />;
  }
  return (
    <View style={styles.fill} onLayout={onLayout}>
      {available && fontMgr && measure ? (
        <PagePager
          db={db}
          info={info}
          fontMgr={fontMgr}
          measure={measure}
          size={available}
          layoutPageNumber={layoutPageNumber}
          onPageChange={onPageChange}
        />
      ) : null}
    </View>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.message}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fdfbf5' },
  fill: { flex: 1 },
  message: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 20, fontWeight: '600', color: '#1a1a1a' },
  body: { fontSize: 15, lineHeight: 22, color: '#333' },
});
