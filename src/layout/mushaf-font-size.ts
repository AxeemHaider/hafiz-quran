import type { Tuning } from './tuning';
import type { Size } from './types';

export type MushafFontSizeInput = {
  /** Each Page's longest justified Line in em (from data prep). Pages with none are left out. */
  longestLineEmByPage: number[];
  /** The font's ink height in em, before vertical stretch. */
  inkHeightEm: number;
  linesPerPage: number;
  /** Width × height available for the Lines. */
  textArea: Size;
  tuning: Tuning;
};

/**
 * One font size for the whole Mushaf on this screen: the largest size at which every Line up to the
 * width cut-off fits the text area's width, and Lines-per-Page Lines of stretched ink fit its height.
 * Pages with longer Lines shrink themselves in `layoutPage`.
 */
export function mushafFontSize({ longestLineEmByPage, inkHeightEm, linesPerPage, textArea, tuning }: MushafFontSizeInput) {
  const withinCutoff = longestLineEmByPage.filter((em) => em <= tuning.widthCutoffEm);
  const longestEm = withinCutoff.length
    ? Math.max(...withinCutoff)
    : longestLineEmByPage.length
      ? tuning.widthCutoffEm
      : 0;
  const widthSize = longestEm > 0 ? textArea.width / longestEm : Infinity;
  const heightSize = textArea.height / linesPerPage / (inkHeightEm * tuning.verticalStretch);
  return Math.min(widthSize, heightSize);
}
