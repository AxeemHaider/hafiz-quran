import { useFonts } from '@shopify/react-native-skia';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DEFAULT_TUNING, layoutPage, mushafFontSize, type Size } from '@/layout';
import { DATA_PREP_COMMAND, MUSHAF_ASSETS } from '@/mushaf/generated-assets';
import { MUSHAF_DB_NAME, readMushafInfo, readPage } from '@/mushaf/mushaf-data';
import { layoutFromPrinted } from '@/mushaf/page-number';

import { PageCanvas } from './page-canvas';
import { MUSHAF_FONT_FAMILY, makeSkiaMeasure } from './skia-text';

/** The Page reader for one printed page number. The Page is drawn dark on light whatever the theme. */
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
  const [available, setAvailable] = useState<Size | null>(null);

  const layoutPageNumber = layoutFromPrinted(printedPage);
  const inRange = Number.isInteger(layoutPageNumber) && layoutPageNumber >= 1 && layoutPageNumber <= info.pageCount;
  const page = useMemo(() => (inRange ? readPage(db, layoutPageNumber) : null), [db, inRange, layoutPageNumber]);

  // The frame isn't drawn yet, so the text area is the safe area, width capped on large screens.
  const textArea = available && {
    width: Math.min(available.width, DEFAULT_TUNING.maxPageWidth),
    height: available.height,
  };
  const textAreaWidth = textArea?.width;
  const textAreaHeight = textArea?.height;

  const fontSize = useMemo(
    () =>
      textAreaWidth && textAreaHeight
        ? mushafFontSize({
            longestLineEmByPage: info.longestLineEmByPage,
            inkHeightEm: info.inkHeightEm,
            linesPerPage: info.linesPerPage,
            textArea: { width: textAreaWidth, height: textAreaHeight },
            tuning: DEFAULT_TUNING,
          })
        : null,
    [info, textAreaWidth, textAreaHeight],
  );
  const measure = useMemo(() => (fontMgr ? makeSkiaMeasure(fontMgr) : null), [fontMgr]);
  const layout = useMemo(
    () =>
      page && measure && fontSize && textAreaWidth && textAreaHeight
        ? layoutPage({
            page,
            linesPerPage: info.linesPerPage,
            measure,
            textArea: { width: textAreaWidth, height: textAreaHeight },
            fontSize,
            tuning: DEFAULT_TUNING,
          })
        : null,
    [page, measure, fontSize, info, textAreaWidth, textAreaHeight],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== available?.width || height !== available?.height) setAvailable({ width, height });
  };

  if (!inRange) {
    return (
      <Message
        title="No such Page"
        body={`Printed page ${printedPage} is not in this Mushaf.`}
      />
    );
  }
  return (
    <View style={styles.fill} onLayout={onLayout}>
      {layout && fontMgr && textAreaWidth && textAreaHeight ? (
        <PageCanvas
          layout={layout}
          fontMgr={fontMgr}
          width={textAreaWidth}
          height={textAreaHeight}
          inkCenterEm={(info.inkTopEm + info.inkBottomEm) / 2}
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
  fill: { flex: 1, alignItems: 'center' },
  message: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 20, fontWeight: '600', color: '#1a1a1a' },
  body: { fontSize: 15, lineHeight: 22, color: '#333' },
});
