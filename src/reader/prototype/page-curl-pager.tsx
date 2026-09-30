/* eslint-disable react-hooks/refs, react-hooks/purity -- gesture callbacks are UI-thread worklets, not render */
/**
 * PROTOTYPE (throwaway, branch prototype/page-curl): a vector page fold for the reader.
 * Question: does a finger-driven fold feel like turning a Mushaf page, and is it smooth in Expo Go?
 * Variants on the reader route via ?variant=: corner (A), straight (B), slide (C, today's FlatList).
 *
 * Every mounted Page is drawn once to an image. One Canvas draws the turn: the target Page underneath,
 * the current Page clipped to the part before the fold line, and the lifted part mirrored across the
 * fold as the flap. All of it is driven by shared values from a Pan gesture; nothing runs on JS per frame.
 */
import {
  BlurMask,
  Canvas,
  Fill,
  Group,
  Image,
  LinearGradient,
  Path,
  Rect,
  Skia,
  drawAsImage,
  vec,
  type SkImage,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PixelRatio, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Easing, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { frameGeometry, pageHeader, type FrameGeometry } from '@/frame/page-frame';
import { rukuSignPlacements } from '@/frame/ruku-signs';
import { DEFAULT_TUNING, layoutPage, mushafFontSize, sizeOf, type Measure, type Size } from '@/layout';
import { readPage, readRukuSigns, type MushafInfo } from '@/mushaf/mushaf-data';
import { pageSide, printedFromLayout } from '@/mushaf/page-number';

import { pageBox } from '../page-box';
import { clampToHinge, foldGeometry, isLeafTurn, toPath } from './fold-geometry';
import { PageDrawing } from '../page-canvas';

export type FoldVariant = 'corner' | 'straight';

const PAPER = '#fdfbf5';
const FLAP_PAPER = '#f1ecdf';
/** Leading edge of the flap moves this much per unit of finger travel. */
const GAIN = 1.4;
/** Corner variant: how much the dragged corner lifts per unit of travel, for a diagonal fold. */
const LIFT = 0.18;
const FLING = 700;
const FINISH_AT = 0.55; // share of the page width the leading edge must pass to finish without a fling
const BACK_OPACITY = 0.3;
const SHOW_THROUGH = 0.06;

type Props = {
  db: SQLiteDatabase;
  info: MushafInfo;
  fontMgr: SkTypefaceFontProvider;
  measure: Measure;
  size: Size;
  layoutPageNumber: number;
  onPageChange: (layoutPage: number) => void;
  variant: FoldVariant;
};

export function PageCurlPager({ db, info, fontMgr, measure, size, layoutPageNumber: targetPage, onPageChange, variant }: Props) {
  const box = pageBox(size, DEFAULT_TUNING.maxPageWidth);
  const W = box.w;
  const H = box.h;
  const frames = useMemo(
    () => ({ right: frameGeometry({ w: W, h: H }, 'right'), left: frameGeometry({ w: W, h: H }, 'left') }),
    [W, H],
  );
  const fontSize = useMemo(
    () =>
      mushafFontSize({
        longestLineEmByPage: info.longestLineEmByPage,
        inkHeightEm: info.inkHeightEm,
        linesPerPage: info.linesPerPage,
        textArea: sizeOf(frames.right.textArea),
        tuning: DEFAULT_TUNING,
      }),
    [info, frames],
  );

  const [current, setCurrent] = useState(targetPage);
  const currentRef = useRef(current);
  const [images, setImages] = useState<Map<number, SkImage>>(new Map());
  const [lastTurnMs, setLastTurnMs] = useState<number | null>(null);

  const cur = useSharedValue(targetPage);
  const dir = useSharedValue(0);
  const p0y = useSharedValue(0);
  const fx = useSharedValue(0);
  const fy = useSharedValue(0);
  const startY = useSharedValue(0);
  const busy = useSharedValue(false);
  const turnStart = useSharedValue(0);

  // Route change from outside: jump, no curl.
  useEffect(() => {
    if (targetPage === currentRef.current) return;
    currentRef.current = targetPage;
    setCurrent(targetPage);
    cur.value = targetPage;
  }, [targetPage, cur]);

  // Draw the window's Pages to images; forget the rest.
  useEffect(() => {
    let cancelled = false;
    const wanted = [current, current + 1, current - 1].filter((p) => p >= 1 && p <= info.pageCount);
    (async () => {
      for (const page of wanted) {
        if (cancelled) return;
        if (images.has(page)) continue;
        const image = await rasterizePage({ db, info, fontMgr, measure, page, frames, fontSize, W, H });
        if (cancelled || !image) return;
        setImages((prev) => {
          const next = new Map([...prev].filter(([p]) => Math.abs(p - currentRef.current) <= 1));
          next.set(page, image);
          return next;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [current, images, db, info, fontMgr, measure, frames, fontSize, W, H]);

  const onTurned = (page: number, ms: number) => {
    currentRef.current = page;
    setCurrent(page);
    setLastTurnMs(Math.round(ms));
    onPageChange(page);
  };

  const corner = variant === 'corner';
  const pageCount = info.pageCount;
  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onStart((e) => {
      startY.value = e.y - box.y;
    })
    .onUpdate((e) => {
      if (busy.value) return;
      if (dir.value === 0) {
        const d = e.translationX > 0 ? 1 : -1;
        const target = cur.value + d;
        if (target < 1 || target > pageCount) return;
        dir.value = d;
        turnStart.value = Date.now();
        p0y.value = corner ? (startY.value > H / 2 ? H : 0) : Math.min(H, Math.max(0, startY.value));
      }
      const t = Math.max(0, dir.value * e.translationX * GAIN);
      const lift = corner ? (p0y.value === H ? -1 : 1) * t * LIFT + e.translationY : 0;
      const f = clampToHinge(t, p0y.value + lift, p0y.value, W, H, corner);
      fx.value = f.x;
      fy.value = f.y;
    })
    .onEnd((e) => {
      if (busy.value || dir.value === 0) return;
      const v = dir.value * e.velocityX;
      const finish = v > FLING || (v > -FLING && fx.value > W * FINISH_AT);
      busy.value = true;
      if (finish) {
        const remaining = 2 * W - fx.value;
        const duration = Math.min(380, Math.max(140, (remaining / Math.max(v, 2.2 * W)) * 1000));
        fy.value = withTiming(p0y.value, { duration, easing: Easing.out(Easing.quad) });
        fx.value = withTiming(2 * W, { duration, easing: Easing.out(Easing.quad) }, (done) => {
          if (!done) return;
          cur.value = cur.value + dir.value;
          dir.value = 0;
          fx.value = 0;
          fy.value = p0y.value;
          busy.value = false;
          scheduleOnRN(onTurned, cur.value, Date.now() - turnStart.value);
        });
      } else {
        const duration = Math.min(300, Math.max(160, fx.value * 0.6));
        fy.value = withTiming(p0y.value, { duration, easing: Easing.out(Easing.cubic) });
        fx.value = withTiming(0, { duration, easing: Easing.out(Easing.cubic) }, () => {
          dir.value = 0;
          busy.value = false;
        });
      }
    });

  const fold = useDerivedValue(() => foldGeometry(W, H, dir.value, p0y.value, fx.value, fy.value));
  const full = useMemo(() => {
    const p = Skia.Path.Make();
    p.addRect(Skia.XYWHRect(0, 0, W, H));
    return p;
  }, [W, H]);
  const stayPath = useDerivedValue(() => (fold.value ? toPath(fold.value.stay) : full));
  const liftedPath = useDerivedValue(() => (fold.value ? toPath(fold.value.lifted) : Skia.Path.Make()));
  const flapPath = useDerivedValue(() => (fold.value ? toPath(fold.value.flap) : Skia.Path.Make()));
  const reflectM = useDerivedValue(() => {
    const r = fold.value?.r ?? [1, 0, 0, 0, 1, 0];
    return Skia.Matrix([r[0], r[1], r[2], r[3], r[4], r[5], 0, 0, 1]);
  });
  // Reflection after mirroring the Page about its centre: the leaf's back, read the right way round.
  const backM = useDerivedValue(() => {
    const r = fold.value?.r ?? [1, 0, 0, 0, 1, 0];
    return Skia.Matrix([-r[0], r[1], r[0] * W + r[2], -r[3], r[4], r[3] * W + r[5], 0, 0, 1]);
  });
  const shadowStart = useDerivedValue(() => (fold.value ? vec(fold.value.m.x, fold.value.m.y) : vec(0, 0)));
  const shadowEnd = useDerivedValue(() => {
    const f = fold.value;
    if (!f) return vec(1, 0);
    // Shadow depth shrinks as the flap nears the spine, so the end of the turn fades cleanly.
    const depth = Math.max(4, Math.min(40, (2 * W - fx.value) * 0.12));
    return vec(f.m.x - f.n.x * depth, f.m.y - f.n.y * depth);
  });
  const creaseEnd = useDerivedValue(() => {
    const f = fold.value;
    if (!f) return vec(1, 0);
    const depth = Math.max(6, Math.min(60, fx.value * 0.25));
    return vec(f.m.x + f.n.x * depth, f.m.y + f.n.y * depth);
  });

  const pages = [...images.entries()];
  const layer = (page: number, role: 'target' | 'current' | 'back' | 'through') => (
    <Layer key={`${role}-${page}`} page={page} role={role} cur={cur} dir={dir} image={images.get(page)!} W={W} H={H} />
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={pan}>
        <View style={{ width: size.width, height: size.height }}>
          <Canvas style={{ width: size.width, height: size.height }}>
            <Fill color={PAPER} />
            <Group transform={[{ translateX: box.x }, { translateY: box.y }]}>
              {pages.map(([p]) => layer(p, 'target'))}
              <Group clip={liftedPath}>
                <Rect x={0} y={0} width={W} height={H}>
                  <LinearGradient start={shadowStart} end={shadowEnd} colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)']} />
                </Rect>
              </Group>
              <Group clip={stayPath}>{pages.map(([p]) => layer(p, 'current'))}</Group>
              <Group clip={stayPath}>
                <Path path={flapPath} color="rgba(0,0,0,0.28)">
                  <BlurMask blur={10} style="normal" />
                </Path>
              </Group>
              <Group clip={flapPath}>
                <Fill color={FLAP_PAPER} />
                <Group matrix={backM}>{pages.map(([p]) => layer(p, 'back'))}</Group>
                <Group matrix={reflectM}>{pages.map(([p]) => layer(p, 'through'))}</Group>
                <Rect x={-W} y={-H} width={3 * W} height={3 * H}>
                  <LinearGradient
                    start={shadowStart}
                    end={creaseEnd}
                    colors={['rgba(0,0,0,0.22)', 'rgba(255,255,255,0.12)', 'rgba(0,0,0,0.05)']}
                    positions={[0, 0.6, 1]}
                  />
                </Rect>
              </Group>
            </Group>
          </Canvas>
          {__DEV__ ? (
            <Text style={{ position: 'absolute', top: 4, left: 8, fontSize: 11, color: '#a33' }}>
              {`PROTOTYPE ${variant} · p${printedFromLayout(current)} (${pageSide(printedFromLayout(current))}) · last turn ${lastTurnMs ?? '–'} ms`}
            </Text>
          ) : null}
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

function Layer({
  page,
  role,
  cur,
  dir,
  image,
  W,
  H,
}: {
  page: number;
  role: 'target' | 'current' | 'back' | 'through';
  cur: SharedValue<number>;
  dir: SharedValue<number>;
  image: SkImage;
  W: number;
  H: number;
}) {
  const opacity = useDerivedValue(() => {
    const target = dir.value !== 0 && page === cur.value + dir.value;
    switch (role) {
      case 'current':
        return page === cur.value ? 1 : 0;
      case 'target':
        return target ? 1 : 0;
      case 'back':
        return target && isLeafTurn(cur.value, dir.value) ? BACK_OPACITY : 0;
      case 'through':
        return page === cur.value && dir.value !== 0 && !isLeafTurn(cur.value, dir.value) ? SHOW_THROUGH : 0;
    }
  });
  return (
    <Group opacity={opacity}>
      <Image image={image} x={0} y={0} width={W} height={H} fit="fill" />
    </Group>
  );
}

async function rasterizePage({
  db,
  info,
  fontMgr,
  measure,
  page,
  frames,
  fontSize,
  W,
  H,
}: {
  db: SQLiteDatabase;
  info: MushafInfo;
  fontMgr: SkTypefaceFontProvider;
  measure: Measure;
  page: number;
  frames: { right: FrameGeometry; left: FrameGeometry };
  fontSize: number;
  W: number;
  H: number;
}): Promise<SkImage | null> {
  const frame = frames[pageSide(printedFromLayout(page))];
  const data = readPage(db, page);
  const layout = layoutPage({
    page: data,
    linesPerPage: info.linesPerPage,
    measure,
    textArea: sizeOf(frame.textArea),
    fontSize,
    tuning: DEFAULT_TUNING,
  });
  const scale = PixelRatio.get();
  return drawAsImage(
    <Group transform={[{ scale }]}>
      <Rect x={0} y={0} width={W} height={H} color={PAPER} />
      <PageDrawing
        layout={layout}
        frame={frame}
        header={pageHeader(data, printedFromLayout(page))}
        placedRukuSigns={rukuSignPlacements(readRukuSigns(db, page), layout.lines, frame)}
        fontMgr={fontMgr}
        inkCenterEm={info.inkCenterEm}
      />
    </Group>,
    { width: Math.ceil(W * scale), height: Math.ceil(H * scale) },
  );
}
