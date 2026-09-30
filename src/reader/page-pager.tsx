import type { SkTypefaceFontProvider } from '@shopify/react-native-skia';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, I18nManager, StyleSheet, View, type ViewToken } from 'react-native';

import { frameGeometry, pageHeader, type FrameGeometry } from '@/frame/page-frame';
import { rukuSignPlacements } from '@/frame/ruku-signs';
import { DEFAULT_TUNING, layoutPage, mushafFontSize, sizeOf, type Box, type Measure, type Size } from '@/layout';
import { readPage, readRukuSigns, type MushafInfo } from '@/mushaf/mushaf-data';
import { pageSide, printedFromLayout } from '@/mushaf/page-number';

import { pageBox } from './page-box';
import { PageCanvas } from './page-canvas';
import { isInWindow, pagerOrder } from './pager-order';

type Props = {
  db: SQLiteDatabase;
  info: MushafInfo;
  fontMgr: SkTypefaceFontProvider;
  measure: Measure;
  /** The safe area the pager fills; each Page item is this size. */
  size: Size;
  /** The layout Page to show; changing it from outside (e.g. a deep link) turns to it. */
  layoutPageNumber: number;
  /** Called when the hafiz turns to another Page. */
  onPageChange: (layoutPage: number) => void;
};

const VIEWABILITY = { itemVisiblePercentThreshold: 60 };

/**
 * A horizontal pager over all Pages in printed order: the next Page comes in from the left, as in the
 * book. Only the current Page and its neighbours are laid out and mounted; the rest are empty items.
 * The Mushaf font size is computed once per Page-box size and shared by every Page. Each Page gets the
 * frame for its side of the open Mushaf, with the margin column on that side.
 */
export function PagePager({ db, info, fontMgr, measure, size, layoutPageNumber: targetPage, onPageChange }: Props) {
  const order = useMemo(() => pagerOrder(info.pageCount, I18nManager.isRTL), [info.pageCount]);
  const indices = useMemo(() => Array.from({ length: info.pageCount }, (_, i) => i), [info.pageCount]);
  const [current, setCurrent] = useState(targetPage);
  const listRef = useRef<FlatList<number>>(null);

  const box = pageBox(size, DEFAULT_TUNING.maxPageWidth);
  const frames = useMemo(
    () => ({ right: frameGeometry({ w: box.w, h: box.h }, 'right'), left: frameGeometry({ w: box.w, h: box.h }, 'left') }),
    [box.w, box.h],
  );
  const fontSize = useMemo(
    () =>
      mushafFontSize({
        longestLineEmByPage: info.longestLineEmByPage,
        inkHeightEm: info.inkHeightEm,
        linesPerPage: info.linesPerPage,
        // The Lines get what's left inside the Page Frame; it is the same size on either side.
        textArea: sizeOf(frames.right.textArea),
        tuning: DEFAULT_TUNING,
      }),
    [info, frames],
  );

  // Kept in refs so FlatList's onViewableItemsChanged can stay one stable function.
  const currentRef = useRef(current);
  const orderRef = useRef(order);
  const onPageChangeRef = useRef(onPageChange);
  useEffect(() => {
    currentRef.current = current;
    orderRef.current = order;
    onPageChangeRef.current = onPageChange;
  }, [current, order, onPageChange]);

  const [onViewable] = useState(() => ({ viewableItems }: { viewableItems: ViewToken<number>[] }) => {
    const index = viewableItems[0]?.index;
    if (index == null) return;
    const page = orderRef.current.pageAt(index);
    if (page === currentRef.current) return;
    currentRef.current = page;
    setCurrent(page);
    onPageChangeRef.current(page);
  });

  // Turn to a Page asked for from outside (a route change), not to the one just swiped to.
  // Scrolling makes it viewable, which updates `current`.
  useEffect(() => {
    if (targetPage === currentRef.current) return;
    listRef.current?.scrollToIndex({ index: order.indexOf(targetPage), animated: false });
  }, [targetPage, order]);

  return (
    <FlatList
      // A new width means new item offsets: remount at the current Page.
      key={size.width}
      ref={listRef}
      data={indices}
      extraData={{ current, fontSize, box, frames }}
      keyExtractor={(index) => String(index)}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      initialScrollIndex={order.indexOf(current)}
      getItemLayout={(_, index) => ({ length: size.width, offset: size.width * index, index })}
      initialNumToRender={1}
      maxToRenderPerBatch={1}
      windowSize={3}
      viewabilityConfig={VIEWABILITY}
      onViewableItemsChanged={onViewable}
      renderItem={({ index }) => {
        const page = order.pageAt(index);
        return (
          <View style={{ width: size.width, height: size.height }}>
            {isInWindow(page, current) ? (
              <WindowedPage
                db={db}
                info={info}
                fontMgr={fontMgr}
                measure={measure}
                layoutPageNumber={page}
                box={box}
                frame={frames[pageSide(printedFromLayout(page))]}
                fontSize={fontSize}
              />
            ) : null}
          </View>
        );
      }}
    />
  );
}

type WindowedPageProps = {
  db: SQLiteDatabase;
  info: MushafInfo;
  fontMgr: SkTypefaceFontProvider;
  measure: Measure;
  layoutPageNumber: number;
  box: Box;
  frame: FrameGeometry;
  fontSize: number;
};

/**
 * One mounted Page: read, laid out at the shared Mushaf font size in the Page Frame's text area, and
 * drawn with its frame (and its ruku signs, level with their Lines) inside its Page box.
 */
function WindowedPage({ db, info, fontMgr, measure, layoutPageNumber, box, frame, fontSize }: WindowedPageProps) {
  const page = useMemo(() => readPage(db, layoutPageNumber), [db, layoutPageNumber]);
  const header = useMemo(() => pageHeader(page, printedFromLayout(layoutPageNumber)), [page, layoutPageNumber]);
  const layout = useMemo(
    () =>
      layoutPage({
        page,
        linesPerPage: info.linesPerPage,
        measure,
        textArea: sizeOf(frame.textArea),
        fontSize,
        tuning: DEFAULT_TUNING,
      }),
    [page, info.linesPerPage, measure, frame, fontSize],
  );
  const placedRukuSigns = useMemo(
    () => rukuSignPlacements(readRukuSigns(db, layoutPageNumber), layout.lines, frame),
    [db, layoutPageNumber, layout, frame],
  );
  return (
    <View style={[styles.box, { left: box.x, top: box.y }]}>
      <PageCanvas
        layout={layout}
        frame={frame}
        header={header}
        placedRukuSigns={placedRukuSigns}
        fontMgr={fontMgr}
        width={box.w}
        height={box.h}
        inkCenterEm={info.inkCenterEm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute' },
});
