/** PROTOTYPE (throwaway): the fold's geometry, as UI-thread worklets. */
import { Skia } from '@shopify/react-native-skia';

export type Pt = { x: number; y: number };

/** Keeps the side of `poly` where f >= 0 (Sutherland–Hodgman against one line). */
export function clipHalf(poly: Pt[], f: (p: Pt) => number): Pt[] {
  'worklet';
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const prev = poly[(i + poly.length - 1) % poly.length];
    const fc = f(cur);
    const fp = f(prev);
    const cross = () => {
      const t = fp / (fp - fc);
      return { x: prev.x + t * (cur.x - prev.x), y: prev.y + t * (cur.y - prev.y) };
    };
    if (fc >= 0) {
      if (fp < 0) out.push(cross());
      out.push(cur);
    } else if (fp >= 0) out.push(cross());
  }
  return out;
}

export function toPath(poly: Pt[]) {
  'worklet';
  const path = Skia.Path.Make();
  poly.forEach((p, i) => (i === 0 ? path.moveTo(p.x, p.y) : path.lineTo(p.x, p.y)));
  path.close();
  return path;
}

/** Keeps the dragged point attached to the hinge edge (turn frame: grabbed edge x=0, hinge x=W). */
export function clampToHinge(fx: number, fy: number, p0y: number, W: number, H: number, corner: boolean): Pt {
  'worklet';
  let x = Math.max(0, fx);
  let y = fy;
  const limit = (hx: number, hy: number, r: number) => {
    const dx = x - hx;
    const dy = y - hy;
    const d = Math.hypot(dx, dy);
    if (d > r) {
      x = hx + (dx * r) / d;
      y = hy + (dy * r) / d;
    }
  };
  limit(W, p0y, W);
  if (corner) limit(W, H - p0y, Math.hypot(W, H));
  return { x, y };
}

export type Fold = {
  stay: Pt[];
  lifted: Pt[];
  flap: Pt[];
  m: Pt;
  n: Pt;
  /** Reflection across the fold: x' = a x + b y + c, y' = b x + d y + e. */
  r: number[];
};

export function foldGeometry(W: number, H: number, dir: number, p0y: number, fx: number, fy: number): Fold | null {
  'worklet';
  const len = Math.hypot(fx, fy - p0y);
  if (dir === 0 || len < 0.5) return null;
  // Turn frame → Page: backward turns grab the right edge, so mirror x.
  const sx = dir === 1 ? 1 : -1;
  const ox = dir === 1 ? 0 : W;
  const m = { x: ox + (sx * fx) / 2, y: (p0y + fy) / 2 };
  const n = { x: (sx * fx) / len, y: (fy - p0y) / len };
  const side = (p: Pt) => (p.x - m.x) * n.x + (p.y - m.y) * n.y;
  const rect = [
    { x: 0, y: 0 },
    { x: W, y: 0 },
    { x: W, y: H },
    { x: 0, y: H },
  ];
  const stay = clipHalf(rect, side);
  const lifted = clipHalf(rect, (p) => -side(p));
  const reflect = (p: Pt) => {
    const k = 2 * side(p);
    return { x: p.x - k * n.x, y: p.y - k * n.y };
  };
  const a = 1 - 2 * n.x * n.x;
  const b = -2 * n.x * n.y;
  const d = 1 - 2 * n.y * n.y;
  const mn = 2 * (m.x * n.x + m.y * n.y);
  return { stay, lifted, flap: lifted.map(reflect), m, n, r: [a, b, mn * n.x, b, d, mn * n.y] };
}

/** A leaf turn in the book: forward from a left-hand Page, backward from a right-hand one. */
export function isLeafTurn(layoutPage: number, dir: number) {
  'worklet';
  const left = (layoutPage + 1) % 2 === 1; // printed = layout + 1; odd printed pages are left-hand
  return (left && dir === 1) || (!left && dir === -1);
}
