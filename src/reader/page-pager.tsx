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
  vec,
  type SkImage,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Easing, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { frameGeometry } from '@/frame/page-frame';
import { DEFAULT_TUNING, mushafFontSize, sizeOf, type Measure, type Size } from '@/layout';
import type { MushafInfo } from '@/mushaf/mushaf-data';
import { pageSide, printedFromLayout } from '@/mushaf/page-number';

import { pageBox } from './page-box';
import {
  dragPoint,
  finishPoint,
  finishesTurn,
  flapBack,
  foldGeometry,
  grabbedCornerY,
  isLeafTurn,
  turnDirection,
  type Affine,
  type Point,
  type TurnDirection,
} from './page-fold';
import { PAPER_COLOR, drawPageImage, usePageImages } from './page-images';

type Props = {
  db: SQLiteDatabase;
  info: MushafInfo;
  fontMgr: SkTypefaceFontProvider;
  measure: Measure;
  /** The safe area the pager fills. */
  size: Size;
  /** The layout Page to show; changing it from outside (e.g. a deep link) jumps to it. */
  layoutPageNumber: number;
  /** Called when the hafiz turns to another Page. */
  onPageChange: (layoutPage: number) => void;
};

/** The back of the paper, a shade darker than its face. */
const FLAP_PAPER_COLOR = '#f1ecdf';
/** How strongly a Leaf's back shows the target Page, and a plain back the current Page through it. */
const LEAF_BACK_OPACITY = 0.3;
const SHOW_THROUGH_OPACITY = 0.06;
/** A turn's settling animation: finishing (ms, scaled by what's left) and springing back. */
const FINISH_MS = { min: 140, max: 380 };
const RETURN_MS = { min: 160, max: 300 };
const IDENTITY: Affine = [1, 0, 0, 0, 1, 0];

/**
 * The reader's Pages, turned by a fold that follows the finger (ADR 0002). Swiping right turns forward:
 * the next Page comes in from the left, as in the book. Each Page in the window is drawn once to an
 * image; one Canvas then draws the turn from shared values, so the drag and the fold stay on the UI
 * thread. JS runs once per turn, when it settles. A route change jumps to its Page without a fold.
 * Quick swipes don't wait: a new swipe lands the turn still settling and starts the next one.
 */
export function PagePager({ db, info, fontMgr, measure, size, layoutPageNumber: targetPage, onPageChange }: Props) {
  const box = pageBox(size, DEFAULT_TUNING.maxPageWidth);
  const page = useMemo(() => ({ width: box.w, height: box.h }), [box.w, box.h]);
  const frames = useMemo(
    () => ({ right: frameGeometry({ w: page.width, h: page.height }, 'right'), left: frameGeometry({ w: page.width, h: page.height }, 'left') }),
    [page],
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
  const draw = useCallback(
    (layoutPage: number) =>
      drawPageImage(
        { db, info, fontMgr, measure, size: page, fontSize, frameFor: (p) => frames[pageSide(printedFromLayout(p))] },
        layoutPage,
      ),
    [db, info, fontMgr, measure, page, fontSize, frames],
  );

  const [current, setCurrent] = useState(targetPage);
  // Jump to a Page asked for from outside (a route change), not to the one just turned to: the route
  // follows the hafiz's own turns too, and by then the UI thread may already be a Page further on.
  const [shownTarget, setShownTarget] = useState(targetPage);
  const [jump, setJump] = useState({ to: targetPage });
  if (targetPage !== shownTarget) {
    setShownTarget(targetPage);
    if (targetPage !== current) {
      setCurrent(targetPage);
      setJump({ to: targetPage });
    }
  }
  const images = usePageImages(current, info.pageCount, draw);

  // The turn, on the UI thread: which Page is current, which way it is turning, the grabbed corner's
  // y, and where that corner has been dragged to (turn frame; see page-fold).
  const currentPage = useSharedValue(current);
  const turning = useSharedValue<0 | TurnDirection>(0);
  const cornerY = useSharedValue(0);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const startY = useSharedValue(0);
  const settling = useSharedValue(false);
  // Where a settling turn lands: on the next or previous Page, or 0 when it is springing back.
  const landing = useSharedValue<0 | TurnDirection>(0);
  // Pages whose image is ready: a turn only starts towards one of these.
  const ready = useSharedValue<number[]>([]);

  useEffect(() => {
    currentPage.set(jump.to);
  }, [jump, currentPage]);
  useEffect(() => {
    ready.set([...images.keys()]);
  }, [images, ready]);

  const onTurned = useCallback(
    (layoutPage: number) => {
      setCurrent(layoutPage);
      onPageChange(layoutPage);
    },
    [onPageChange],
  );

  const pageCount = info.pageCount;
  /** Starts a turn the way the swipe has travelled, if that Page is ready; false if none started. */
  const startTurn = (translationX: number) => {
    'worklet';
    const dir = turnDirection(translationX);
    if (dir === 0) return false;
    const target = currentPage.get() + dir;
    if (target < 1 || target > pageCount || !ready.get().includes(target)) return false;
    turning.set(dir);
    cornerY.set(grabbedCornerY(startY.get(), page));
    return true;
  };
  /** Moves the grabbed corner to where the swipe has dragged it. */
  const drag = (translationX: number, translationY: number) => {
    'worklet';
    const dir = turning.get() as TurnDirection;
    const point = dragPoint({ x: translationX, y: translationY }, dir, cornerY.get(), page);
    dragX.set(point.x);
    dragY.set(point.y);
  };
  /** Ends a settling turn at once, where it was going: the turn is over and the Page lies flat. */
  const land = () => {
    'worklet';
    const dir = landing.get();
    if (dir !== 0) {
      const turnedTo = currentPage.get() + dir;
      currentPage.set(turnedTo);
      scheduleOnRN(onTurned, turnedTo);
    }
    landing.set(0);
    turning.set(0);
    dragX.set(0);
    settling.set(false);
  };
  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onBegin((e) => {
      startY.set(e.y - box.y);
    })
    .onStart(() => {
      // A new swipe doesn't wait for the last turn to settle.
      if (settling.get()) land();
    })
    .onUpdate((e) => {
      if (turning.get() === 0 && !startTurn(e.translationX)) return;
      drag(e.translationX, e.translationY);
    })
    .onEnd((e) => {
      // A quick flick can end before any update has travelled: it still turns.
      if (turning.get() === 0 && startTurn(e.translationX)) drag(e.translationX, e.translationY);
      const dir = turning.get();
      if (settling.get() || dir === 0) return;
      settling.set(true);
      const velocity = dir * e.velocityX;
      const from = { x: dragX.get(), y: dragY.get() };
      // A swipe that lands the turn first cancels these animations; then `done` is false.
      if (finishesTurn(from, velocity, page)) {
        landing.set(dir);
        const to = finishPoint(cornerY.get(), page);
        const ms = ((to.x - from.x) / Math.max(velocity, 2.2 * page.width)) * 1000;
        const duration = Math.min(FINISH_MS.max, Math.max(FINISH_MS.min, ms));
        const easing = Easing.out(Easing.quad);
        dragY.set(withTiming(to.y, { duration, easing }));
        dragX.set(
          withTiming(to.x, { duration, easing }, (done) => {
            if (done) land();
          }),
        );
      } else {
        const duration = Math.min(RETURN_MS.max, Math.max(RETURN_MS.min, from.x * 0.6));
        const easing = Easing.out(Easing.cubic);
        dragY.set(withTiming(cornerY.get(), { duration, easing }));
        dragX.set(
          withTiming(0, { duration, easing }, (done) => {
            if (done) land();
          }),
        );
      }
    });

  const fold = useDerivedValue(() => {
    const dir = turning.get();
    return dir === 0 ? null : foldGeometry(page, dir, cornerY.get(), { x: dragX.get(), y: dragY.get() });
  });
  const whole = useMemo(() => Skia.Path.Rect(Skia.XYWHRect(0, 0, page.width, page.height)), [page]);
  const flatPath = useDerivedValue(() => {
    const f = fold.get();
    return f ? toPath(f.flat) : whole;
  });
  const liftedPath = useDerivedValue(() => toPath(fold.get()?.lifted ?? []));
  const flapPath = useDerivedValue(() => toPath(fold.get()?.flap ?? []));
  const flapMatrix = useDerivedValue(() => toMatrix(fold.get()?.reflection ?? IDENTITY));
  const leafBackMatrix = useDerivedValue(() => toMatrix(flapBack(fold.get()?.reflection ?? IDENTITY, page)));
  // Shadow on the target Page, falling away from the fold; it thins as the flap nears the hinge.
  const crease = useDerivedValue(() => {
    const f = fold.get();
    return f ? vec(f.crease.x, f.crease.y) : vec(0, 0);
  });
  const shadowEnd = useDerivedValue(() => {
    const f = fold.get();
    if (!f) return vec(1, 0);
    const depth = Math.max(4, Math.min(40, (2 * page.width - dragX.get()) * 0.12));
    return vec(f.crease.x - f.normal.x * depth, f.crease.y - f.normal.y * depth);
  });
  // Shading across the flap from the fold, so it reads as paper bending over.
  const creaseShadingEnd = useDerivedValue(() => {
    const f = fold.get();
    if (!f) return vec(1, 0);
    const depth = Math.max(6, Math.min(60, dragX.get() * 0.25));
    return vec(f.crease.x + f.normal.x * depth, f.crease.y + f.normal.y * depth);
  });

  const drawn = [...images];
  const layers = (role: LayerRole) =>
    drawn.map(([layoutPage, image]) => (
      <PageLayer
        key={layoutPage}
        layoutPage={layoutPage}
        image={image}
        role={role}
        page={page}
        currentPage={currentPage}
        turning={turning}
      />
    ));

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={pan}>
        <View style={{ width: size.width, height: size.height }}>
          <Canvas style={{ width: size.width, height: size.height }}>
            <Fill color={PAPER_COLOR} />
            <Group transform={[{ translateX: box.x }, { translateY: box.y }]}>
              {layers('target')}
              <Group clip={liftedPath}>
                <Rect x={0} y={0} width={page.width} height={page.height}>
                  <LinearGradient start={crease} end={shadowEnd} colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)']} />
                </Rect>
              </Group>
              <Group clip={flatPath}>
                {layers('current')}
                <Path path={flapPath} color="rgba(0,0,0,0.28)">
                  <BlurMask blur={10} style="normal" />
                </Path>
              </Group>
              <Group clip={flapPath}>
                <Fill color={FLAP_PAPER_COLOR} />
                <Group matrix={leafBackMatrix}>{layers('leafBack')}</Group>
                <Group matrix={flapMatrix}>{layers('showThrough')}</Group>
                <Rect x={-page.width} y={-page.height} width={3 * page.width} height={3 * page.height}>
                  <LinearGradient
                    start={crease}
                    end={creaseShadingEnd}
                    colors={['rgba(0,0,0,0.22)', 'rgba(255,255,255,0.12)', 'rgba(0,0,0,0.05)']}
                    positions={[0, 0.6, 1]}
                  />
                </Rect>
              </Group>
            </Group>
          </Canvas>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

/**
 * What a Page's image is drawn as in a turn: the target underneath, the current Page before the fold,
 * the target on a Leaf's back, or the current Page showing faintly through a plain back.
 */
type LayerRole = 'target' | 'current' | 'leafBack' | 'showThrough';

type PageLayerProps = {
  layoutPage: number;
  image: SkImage;
  role: LayerRole;
  page: Size;
  currentPage: SharedValue<number>;
  turning: SharedValue<0 | TurnDirection>;
};

/** One Page's image in one role; shown only while the turn gives the Page that role. */
function PageLayer({ layoutPage, image, role, page, currentPage, turning }: PageLayerProps) {
  const opacity = useDerivedValue(() => {
    const dir = turning.get();
    const current = currentPage.get();
    const isCurrent = layoutPage === current;
    const isTarget = dir !== 0 && layoutPage === current + dir;
    switch (role) {
      case 'current':
        return isCurrent ? 1 : 0;
      case 'target':
        return isTarget ? 1 : 0;
      case 'leafBack':
        return isTarget && isLeafTurn(current, dir) ? LEAF_BACK_OPACITY : 0;
      case 'showThrough':
        return isCurrent && dir !== 0 && !isLeafTurn(current, dir) ? SHOW_THROUGH_OPACITY : 0;
    }
  });
  return (
    <Group opacity={opacity}>
      <Image image={image} x={0} y={0} width={page.width} height={page.height} fit="fill" />
    </Group>
  );
}

function toPath(polygon: Point[]) {
  'worklet';
  const builder = Skia.PathBuilder.Make();
  polygon.forEach((p, i) => (i === 0 ? builder.moveTo(p.x, p.y) : builder.lineTo(p.x, p.y)));
  if (polygon.length > 0) builder.close();
  return builder.detach();
}

function toMatrix([a, b, c, d, e, f]: Affine) {
  'worklet';
  return Skia.Matrix([a, b, c, d, e, f, 0, 0, 1]);
}
