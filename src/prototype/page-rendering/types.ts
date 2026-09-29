// PROTOTYPE (ticket #6).
import type { SkTypefaceFontProvider } from '@shopify/react-native-skia';

import type { FontName, Page, Unit } from './data';
import type { FitRule, Stats } from './layout';

export type VariantProps = {
  page: Page;
  W: number;
  H: number;
  font: FontName;
  fontMgr: SkTypefaceFontProvider;
  rule: FitRule;
  /** Vertical stretch of every word (1 = font as designed). Width is unchanged, so Lines still fit. */
  stretch: number;
  showBoxes: boolean;
  selected: string | null;
  onSelect: (u: Unit | null) => void;
  onStats: (page: number, s: Stats) => void;
};
