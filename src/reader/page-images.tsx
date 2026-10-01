import { Group, Rect, drawAsImage, type SkImage, type SkTypefaceFontProvider } from '@shopify/react-native-skia';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PixelRatio } from 'react-native';

import { pageHeader, type FrameGeometry } from '@/frame/page-frame';
import { rukuSignPlacements } from '@/frame/ruku-signs';
import { DEFAULT_TUNING, layoutPage, sizeOf, type Measure, type Size } from '@/layout';
import { readPage, readRukuSigns, type MushafInfo } from '@/mushaf/mushaf-data';
import { printedFromLayout } from '@/mushaf/page-number';

import { PageDrawing } from './page-drawing';
import { windowPages } from './page-window';

/** The paper every Page is drawn on. */
export const PAPER_COLOR = '#fdfbf5';

export type DrawPageImage = (layoutPage: number) => Promise<SkImage | null>;

type PageImageSource = {
  db: SQLiteDatabase;
  info: MushafInfo;
  fontMgr: SkTypefaceFontProvider;
  measure: Measure;
  /** The Page box's size; the image is this size in pixels at the screen's density. */
  size: Size;
  /** The frame for a layout Page: the one for its side of the open Mushaf. */
  frameFor: (layoutPage: number) => FrameGeometry;
  /** The shared Mushaf font size. */
  fontSize: number;
};

/**
 * Draws a Page offscreen to an image, once, so a Page Turn can redraw it every frame cheaply (ADR
 * 0002): read, laid out at the shared Mushaf font size in the Page Frame's text area, drawn on paper
 * with its frame and its ruku signs, at the screen's pixel density so the text stays sharp.
 */
export function drawPageImage(source: PageImageSource, layoutPageNumber: number): Promise<SkImage | null> {
  const { db, info, fontMgr, measure, size, frameFor, fontSize } = source;
  const frame = frameFor(layoutPageNumber);
  const page = readPage(db, layoutPageNumber);
  const layout = layoutPage({
    page,
    linesPerPage: info.linesPerPage,
    measure,
    textArea: sizeOf(frame.textArea),
    fontSize,
    tuning: DEFAULT_TUNING,
  });
  const scale = PixelRatio.get();
  return drawAsImage(
    <Group transform={[{ scale }]}>
      <Rect x={0} y={0} width={size.width} height={size.height} color={PAPER_COLOR} />
      <PageDrawing
        layout={layout}
        frame={frame}
        header={pageHeader(page, printedFromLayout(layoutPageNumber))}
        placedRukuSigns={rukuSignPlacements(readRukuSigns(db, layoutPageNumber), layout.lines, frame)}
        fontMgr={fontMgr}
        inkCenterEm={info.inkCenterEm}
      />
    </Group>,
    { width: Math.ceil(size.width * scale), height: Math.ceil(size.height * scale) },
  );
}

type Drawn = { draw: DrawPageImage; images: Map<number, SkImage> };

/**
 * The images of the Pages in the window around the current one, drawn one at a time, the current Page
 * first. Pages that leave the window are forgotten; a new `draw` (a new size or font) starts over.
 * A turn while a Page is being drawn does not throw the drawing away if the Page is still in the window.
 */
export function usePageImages(currentLayoutPage: number, pageCount: number, draw: DrawPageImage) {
  const [drawn, setDrawn] = useState<Drawn>({ draw, images: new Map() });
  const images = useMemo(() => (drawn.draw === draw ? drawn.images : new Map<number, SkImage>()), [drawn, draw]);
  const pages = useMemo(() => windowPages(currentLayoutPage, pageCount), [currentLayoutPage, pageCount]);
  const missing = pages.find((page) => !images.has(page));
  // The window when a drawing finishes, which may have moved on since it started.
  const latestPages = useRef(pages);
  useEffect(() => {
    latestPages.current = pages;
  }, [pages]);

  useEffect(() => {
    if (missing === undefined) return;
    let cancelled = false;
    draw(missing).then((image) => {
      const inWindow = latestPages.current;
      if (cancelled || !image || !inWindow.includes(missing)) return;
      setDrawn((prev) => {
        const kept = prev.draw === draw ? [...prev.images].filter(([page]) => inWindow.includes(page)) : [];
        return { draw, images: new Map([...kept, [missing, image]]) };
      });
    });
    return () => {
      cancelled = true;
    };
  }, [missing, draw]);

  return images;
}
