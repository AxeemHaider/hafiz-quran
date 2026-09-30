import type { Box, Size } from '@/layout';

/**
 * Where the Page sits inside the safe area: the whole safe area on phones; on wider screens
 * (tablets) the width is capped at `maxWidth` (the tuning's tablet cap) and the box is centred.
 */
export function pageBox(safeArea: Size, maxWidth: number): Box {
  const w = Math.min(safeArea.width, maxWidth);
  return { x: (safeArea.width - w) / 2, y: 0, w, h: safeArea.height };
}
