import { Canvas, Group, Paragraph, type SkTypefaceFontProvider } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';

import type { PageLayout } from '@/layout';

import { makeWordParagraph } from './skia-text';

type Props = {
  layout: PageLayout;
  fontMgr: SkTypefaceFontProvider;
  width: number;
  height: number;
  /** Middle of the font's ink, above the baseline, in em: what gets centred on each Line's centre. */
  inkCenterEm: number;
};

/** Slack so a word laid out at its own width never wraps. */
const WIDTH_SLACK = 2;

/**
 * Draws a PageLayout: each word as its own RTL Paragraph where the layout put it. No layout logic here.
 * An RTL Paragraph right-aligns inside its layout width, so each word's right edge is pinned to the
 * layout's anchor; it is then widened leftward by the Line's scale and stretched around the Line centre.
 */
export function PageCanvas({ layout, fontMgr, width, height, inkCenterEm }: Props) {
  const words = useMemo(
    () =>
      layout.lines.flatMap((line) =>
        line.words.map((word) => {
          const paragraph = makeWordParagraph(fontMgr, word.text, layout.fontSize);
          const baseline = paragraph.getLineMetrics()[0]?.baseline ?? 0;
          const paragraphWidth = Math.ceil(word.measuredWidth) + WIDTH_SLACK;
          return {
            key: word.id,
            paragraph,
            origin: { x: word.anchorX, y: line.centerY },
            transform: [{ scaleX: line.scaleX }, { scaleY: line.scaleY }],
            x: word.anchorX - paragraphWidth,
            y: line.centerY + inkCenterEm * layout.fontSize - baseline,
            width: paragraphWidth,
          };
        }),
      ),
    [layout, fontMgr, inkCenterEm],
  );

  useEffect(() => () => words.forEach((w) => w.paragraph.dispose()), [words]);

  return (
    <Canvas style={{ width, height }}>
      {words.map((w) => (
        <Group key={w.key} origin={w.origin} transform={w.transform}>
          <Paragraph paragraph={w.paragraph} x={w.x} y={w.y} width={w.width} />
        </Group>
      ))}
    </Canvas>
  );
}
