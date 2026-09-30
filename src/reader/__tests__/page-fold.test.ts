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
} from '@/reader/page-fold';

const page = { width: 360, height: 700 };
const apply = ([a, b, c, d, e, f]: Affine, p: Point) => ({ x: a * p.x + b * p.y + c, y: d * p.x + e * p.y + f });
const area = (poly: Point[]) =>
  Math.abs(poly.reduce((sum, p, i) => sum + p.x * poly[(i + 1) % poly.length].y - poly[(i + 1) % poly.length].x * p.y, 0)) / 2;
const close = (p: Point, q: Point) => {
  expect(p.x).toBeCloseTo(q.x, 6);
  expect(p.y).toBeCloseTo(q.y, 6);
};

describe('turn direction', () => {
  test('swiping right turns forward, so the next Page comes in from the left as in the Mushaf', () => {
    expect(turnDirection(40)).toBe(1);
    expect(turnDirection(-40)).toBe(-1);
  });

  test('a swipe starting in the top half grabs the top corner, otherwise the bottom one', () => {
    expect(grabbedCornerY(100, page)).toBe(0);
    expect(grabbedCornerY(500, page)).toBe(700);
  });
});

describe('Leaf turns', () => {
  // Layout Page 2 is printed 3, a left-hand Page; layout Page 1 is printed 2, a right-hand Page.
  test('forward from a left-hand Page turns a Leaf over its spine; back from it does not', () => {
    expect(isLeafTurn(2, 1)).toBe(true);
    expect(isLeafTurn(2, -1)).toBe(false);
  });

  test('back from a right-hand Page turns a Leaf; forward to the Page beside it does not', () => {
    expect(isLeafTurn(1, -1)).toBe(true);
    expect(isLeafTurn(1, 1)).toBe(false);
  });
});

describe('drag → dragged corner', () => {
  test('the corner moves along the turn faster than the finger and lifts off its edge', () => {
    const point = dragPoint({ x: 100, y: 0 }, 1, 700, page);
    expect(point.x).toBeCloseTo(140);
    expect(point.y).toBeLessThan(700);
    expect(dragPoint({ x: 100, y: 0 }, 1, 0, page).y).toBeGreaterThan(0);
  });

  test('a backward turn reads a leftward drag as travel along the turn', () => {
    expect(dragPoint({ x: -100, y: 0 }, -1, 700, page).x).toBeCloseTo(140);
  });

  test('dragging back past the start lifts nothing', () => {
    expect(dragPoint({ x: -50, y: 0 }, 1, 700, page)).toEqual({ x: 0, y: 700 });
  });

  test('the paper stays attached to the hinge, however far the finger goes', () => {
    for (const translation of [{ x: 2000, y: 0 }, { x: 300, y: -900 }, { x: 900, y: 600 }]) {
      const point = dragPoint(translation, 1, 700, page);
      expect(Math.hypot(point.x - 360, point.y - 700)).toBeLessThanOrEqual(360 + 1e-9);
    }
  });
});

describe('fold geometry', () => {
  test('nothing is folded at rest', () => {
    expect(foldGeometry(page, 1, 700, { x: 0, y: 700 })).toBeNull();
  });

  test('forward: the grabbed left corner folds over onto the finger, and the hinge edge stays flat', () => {
    const point = { x: 200, y: 650 };
    const fold = foldGeometry(page, 1, 700, point)!;
    close(apply(fold.reflection, { x: 0, y: 700 }), point);
    expect(area(fold.flat) + area(fold.lifted)).toBeCloseTo(360 * 700);
    expect(fold.flat).toContainEqual({ x: 360, y: 0 });
    expect(fold.flat).toContainEqual({ x: 360, y: 700 });
    expect(area(fold.flap)).toBeCloseTo(area(fold.lifted));
  });

  test('backward: the turn is mirrored, grabbing the right corner and hinging on the left edge', () => {
    const fold = foldGeometry(page, -1, 0, { x: 200, y: 50 })!;
    close(apply(fold.reflection, { x: 360, y: 0 }), { x: 160, y: 50 });
    expect(fold.flat).toContainEqual({ x: 0, y: 0 });
    expect(fold.flat).toContainEqual({ x: 0, y: 700 });
  });

  test('a finished turn has lifted the whole Page, showing the target Page', () => {
    const fold = foldGeometry(page, 1, 700, finishPoint(700, page))!;
    expect(area(fold.flat)).toBeCloseTo(0);
    expect(area(fold.lifted)).toBeCloseTo(360 * 700);
  });

  test("the flap's back reads the right way round: fully turned, it is a Page lying beyond the hinge", () => {
    const forward = foldGeometry(page, 1, 700, finishPoint(700, page))!;
    close(apply(flapBack(forward.reflection, page), { x: 10, y: 20 }), { x: 370, y: 20 });
    const backward = foldGeometry(page, -1, 700, finishPoint(700, page))!;
    close(apply(flapBack(backward.reflection, page), { x: 10, y: 20 }), { x: -350, y: 20 });
  });
});

describe('release', () => {
  const near = { x: 100, y: 700 };
  const far = { x: 250, y: 700 };

  test('a fling along the turn finishes it, even from a short drag', () => {
    expect(finishesTurn(near, 1200, page)).toBe(true);
  });

  test('a fling against the turn springs it back, even from a long drag', () => {
    expect(finishesTurn(far, -1200, page)).toBe(false);
  });

  test('without a fling, the turn finishes only past the finish point', () => {
    expect(finishesTurn(far, 0, page)).toBe(true);
    expect(finishesTurn(near, 0, page)).toBe(false);
  });
});
