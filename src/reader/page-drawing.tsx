import { Group, Paragraph, type SkTypefaceFontProvider } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import { lineRuleYs, type FrameGeometry, type PageHeader } from '@/frame/page-frame';
import type { PlacedRukuSign } from '@/frame/ruku-signs';
import type { PageLayout } from '@/layout';

import { FrameDrawing } from './frame-drawing';
import { placeText, useDisposeTexts } from './skia-text';

type Props = {
  /** The Page's Lines, laid out in the frame's text area (text-area coordinates). */
  layout: PageLayout;
  frame: FrameGeometry;
  header: PageHeader;
  /** The ruku signs in the margin column, placed (Page coordinates). */
  placedRukuSigns: PlacedRukuSign[];
  fontMgr: SkTypefaceFontProvider;
  /** Middle of the font's ink, above the baseline, in em: what gets centred on each Line's centre. */
  inkCenterEm: number;
};

/**
 * Draws a Page: its Page Frame, then its PageLayout inside the frame's text area. Each word is its own
 * RTL Paragraph where the layout put it; no layout logic here. Each word's right edge is pinned to the
 * layout's anchor; it is then widened leftward by the Line's scale and stretched around the Line centre.
 * It has no Canvas of its own: the pager draws it offscreen, once, to the Page's image.
 */
export function PageDrawing({ layout, frame, header, placedRukuSigns, fontMgr, inkCenterEm }: Props) {
  const words = useMemo(
    () =>
      layout.lines.flatMap((line) =>
        line.words.map((word) => ({
          key: word.id,
          origin: { x: word.anchorX, y: line.centerY },
          transform: [{ scaleX: line.scaleX }, { scaleY: line.scaleY }],
          ...placeText(fontMgr, word.text, {
            fontSize: layout.fontSize,
            inkCenterEm,
            centerY: line.centerY,
            rightEdge: word.anchorX,
            textWidth: word.measuredWidth,
          }),
        })),
      ),
    [layout, fontMgr, inkCenterEm],
  );
  useDisposeTexts(words);

  return (
    <>
      <FrameDrawing
        frame={frame}
        header={header}
        placedRukuSigns={placedRukuSigns}
        lineRuleYs={lineRuleYs(layout)}
        fontMgr={fontMgr}
        inkCenterEm={inkCenterEm}
      />
      <Group transform={[{ translateX: frame.textArea.x }, { translateY: frame.textArea.y }]}>
        {words.map((w) => (
          <Group key={w.key} origin={w.origin} transform={w.transform}>
            <Paragraph paragraph={w.paragraph} x={w.x} y={w.y} width={w.width} />
          </Group>
        ))}
      </Group>
    </>
  );
}
