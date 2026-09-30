import { Group, Line, Paragraph, Rect, type SkTypefaceFontProvider } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';

import type { Box } from '@/layout';
import type { FrameGeometry, PageHeader } from '@/frame/page-frame';

import { INK_COLOR, makeWordParagraph } from './skia-text';

type Props = {
  frame: FrameGeometry;
  header: PageHeader;
  /** Where the thin rules between Lines go, in text-area coordinates. */
  lineRuleYs: number[];
  fontMgr: SkTypefaceFontProvider;
  /** Middle of the font's ink above the baseline, in em, so header text is centred on its ink. */
  inkCenterEm: number;
};

/** Header text size, as a share of the header strip's height. */
const HEADER_TEXT = 0.7;
const WIDTH_SLACK = 2;

/**
 * Draws the Page Frame, in the same Canvas and coordinates as the Lines: the header strip (surah on
 * the left, printed page number in the centre, Para on the right, as in the Taj print), the double-rule
 * border, the thin rules between Lines and the empty margin column. No geometry of its own.
 */
export function FrameDrawing({ frame, header, lineRuleYs, fontMgr, inkCenterEm }: Props) {
  const { header: strip, innerBorder, outerBorder, marginColumn, textArea, ruleWidths } = frame;

  const texts = useMemo(() => {
    const fontSize = strip.h * HEADER_TEXT;
    const centerY = strip.y + strip.h / 2;
    const left = innerBorder.x;
    const right = innerBorder.x + innerBorder.w;
    const middle = outerBorder.x + outerBorder.w / 2;
    // Each text by its right edge: a paragraph laid out RTL right-aligns inside its width.
    const place = (text: string, rightEdge: (w: number) => number) => {
      const paragraph = makeWordParagraph(fontMgr, text, fontSize);
      const w = paragraph.getMaxIntrinsicWidth();
      const width = Math.ceil(w) + WIDTH_SLACK;
      const baseline = paragraph.getLineMetrics()[0]?.baseline ?? 0;
      return { key: text, paragraph, x: rightEdge(w) - width, y: centerY + inkCenterEm * fontSize - baseline, width };
    };
    return [
      place(header.para, () => right),
      place(header.pageNumber, (w) => middle + w / 2),
      place(header.surah, (w) => left + w),
    ];
  }, [fontMgr, header, strip, innerBorder, outerBorder, inkCenterEm]);

  useEffect(() => () => texts.forEach((t) => t.paragraph.dispose()), [texts]);

  return (
    <Group>
      {texts.map((t) => (
        <Paragraph key={t.key} paragraph={t.paragraph} x={t.x} y={t.y} width={t.width} />
      ))}
      <Stroke box={outerBorder} width={ruleWidths.outer} />
      <Stroke box={innerBorder} width={ruleWidths.inner} />
      <Stroke box={marginColumn} width={ruleWidths.line} />
      {lineRuleYs.map((y) => (
        <Line
          key={y}
          p1={{ x: innerBorder.x, y: textArea.y + y }}
          p2={{ x: innerBorder.x + innerBorder.w, y: textArea.y + y }}
          color={INK_COLOR}
          strokeWidth={ruleWidths.line}
        />
      ))}
    </Group>
  );
}

function Stroke({ box, width }: { box: Box; width: number }) {
  return (
    <Rect x={box.x} y={box.y} width={box.w} height={box.h} style="stroke" strokeWidth={width} color={INK_COLOR} />
  );
}
