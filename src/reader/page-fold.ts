import type { Size } from '@/layout';
import { pageSide, printedFromLayout } from '@/mushaf/page-number';

/**
 * The geometry of a Page Turn (ADR 0002): a finger drag becomes a fold line across the Page. Every
 * function is a worklet, run on the UI thread each frame; all coordinates are the Page box's.
 *
 * A turn grabs a corner on one side edge and folds it over towards the opposite edge, the hinge. The
 * maths runs in a "turn frame" where the grabbed edge is x = 0 and the hinge x = width; backward turns
 * grab the right edge, so their turn frame is mirrored.
 */

/** Which way a Page Turn goes: 1 to the next Page, -1 to the previous one. */
export type TurnDirection = 1 | -1;
export type Point = { x: number; y: number };
/** An affine map: x' = a x + b y + c, y' = d x + e y + f, as [a, b, c, d, e, f]. */
export type Affine = [number, number, number, number, number, number];

// Helpers first: worklet functions become constants when compiled, so they aren't hoisted.
function keepWithin(point: Point, centre: Point, radius: number) {
  'worklet';
  const dx = point.x - centre.x;
  const dy = point.y - centre.y;
  const d = Math.hypot(dx, dy);
  if (d <= radius) return;
  point.x = centre.x + (dx * radius) / d;
  point.y = centre.y + (dy * radius) / d;
}

/** The part of a convex polygon where `side` >= 0 (one Sutherland–Hodgman pass). */
function clipToHalfPlane(polygon: Point[], side: (p: Point) => number): Point[] {
  'worklet';
  const out: Point[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const cur = polygon[i];
    const prev = polygon[(i + polygon.length - 1) % polygon.length];
    const sc = side(cur);
    const sp = side(prev);
    if (sc >= 0 !== sp >= 0) {
      const t = sp / (sp - sc);
      out.push({ x: prev.x + t * (cur.x - prev.x), y: prev.y + t * (cur.y - prev.y) });
    }
    if (sc >= 0) out.push(cur);
  }
  return out;
}

export const TURN_TUNING = {
  /** The flap's leading edge moves this much per unit of finger travel. */
  gain: 1.4,
  /** How much the grabbed corner lifts per unit of travel, so the fold runs diagonally. */
  lift: 0.18,
  /** A fling this fast (px/s) along the turn finishes it; one this fast against it springs back. */
  flingVelocity: 700,
  /** Without a fling, the leading edge must pass this share of the Page width to finish the turn. */
  finishAt: 0.55,
};

/** Swiping right turns forward: the next Page comes in from the left, as in the printed Mushaf. */
export function turnDirection(translationX: number): TurnDirection {
  'worklet';
  return translationX > 0 ? 1 : -1;
}

/** The y of the corner a turn grabs: the top one if the swipe starts in the Page's top half. */
export function grabbedCornerY(startY: number, page: Size): number {
  'worklet';
  return startY < page.height / 2 ? 0 : page.height;
}

/**
 * Where the grabbed corner has been dragged to (turn frame). It moves along the turn by the finger's
 * travel times the gain, lifts off its edge as it goes, follows the finger up and down, and stays
 * attached to the hinge edge: never farther from the hinge than the paper reaches.
 */
export function dragPoint(
  translation: Point,
  dir: TurnDirection,
  cornerY: number,
  page: Size,
  tuning = TURN_TUNING,
): Point {
  'worklet';
  const travel = Math.max(0, dir * translation.x * tuning.gain);
  const lift = (cornerY === 0 ? 1 : -1) * travel * tuning.lift;
  const point = { x: travel, y: cornerY + lift + translation.y };
  const { width, height } = page;
  keepWithin(point, { x: width, y: cornerY }, width);
  keepWithin(point, { x: width, y: height - cornerY }, Math.hypot(width, height));
  return point;
}

/** Where the dragged corner ends a finished turn: folded flat over the hinge, off the Page. */
export function finishPoint(cornerY: number, page: Size): Point {
  'worklet';
  return { x: 2 * page.width, y: cornerY };
}

/** Whether a released drag finishes the turn: a fling along it, or far enough without a fling against it. */
export function finishesTurn(point: Point, velocityAlongTurn: number, page: Size, tuning = TURN_TUNING): boolean {
  'worklet';
  if (velocityAlongTurn > tuning.flingVelocity) return true;
  if (velocityAlongTurn < -tuning.flingVelocity) return false;
  return point.x > page.width * tuning.finishAt;
}

export type Fold = {
  /** The part of the current Page still lying flat, before the fold line. */
  flat: Point[];
  /** The part lifted off, where the target Page now shows. */
  lifted: Point[];
  /** The lifted part folded over the fold line: the back of the paper. */
  flap: Point[];
  /** The fold line's midpoint, and its unit normal pointing from the lifted side to the flat side. */
  crease: Point;
  normal: Point;
  /** Reflection across the fold line: takes the lifted part onto the flap. */
  reflection: Affine;
};

/** The fold for a corner dragged to `point` (turn frame), in Page coordinates; null when nothing is lifted. */
export function foldGeometry(page: Size, dir: TurnDirection, cornerY: number, point: Point): Fold | null {
  'worklet';
  const len = Math.hypot(point.x, point.y - cornerY);
  if (len < 0.5) return null;
  const { width, height } = page;
  // Turn frame → Page: a backward turn grabs the right edge, so x is mirrored.
  const crease = { x: (dir === 1 ? 0 : width) + (dir * point.x) / 2, y: (cornerY + point.y) / 2 };
  const normal = { x: (dir * point.x) / len, y: (point.y - cornerY) / len };
  const side = (p: Point) => (p.x - crease.x) * normal.x + (p.y - crease.y) * normal.y;
  const page4 = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  const flat = clipToHalfPlane(page4, side);
  const lifted = clipToHalfPlane(page4, (p) => -side(p));
  const reflect = (p: Point) => {
    const k = 2 * side(p);
    return { x: p.x - k * normal.x, y: p.y - k * normal.y };
  };
  const along = 2 * (crease.x * normal.x + crease.y * normal.y);
  const b = -2 * normal.x * normal.y;
  const reflection: Affine = [
    1 - 2 * normal.x * normal.x,
    b,
    along * normal.x,
    b,
    1 - 2 * normal.y * normal.y,
    along * normal.y,
  ];
  return { flat, lifted, flap: lifted.map(reflect), crease, normal, reflection };
}

/**
 * Where a Page drawn on the flap's back goes: mirrored about the Page's centre (it is the other face
 * of the paper), then folded over with the flap. It reads the right way round.
 */
export function flapBack(reflection: Affine, page: Size): Affine {
  'worklet';
  const [a, b, c, d, e, f] = reflection;
  return [-a, b, a * page.width + c, -d, e, d * page.width + f];
}

/**
 * Whether a turn is a Leaf turn: in a real book it turns a Leaf, forward from a left-hand Page or
 * back from a right-hand one. Then the flap's back is the target Page; otherwise it is plain paper.
 */
export function isLeafTurn(layoutPage: number, dir: TurnDirection): boolean {
  'worklet';
  const side = pageSide(printedFromLayout(layoutPage));
  return side === 'left' ? dir === 1 : dir === -1;
}
