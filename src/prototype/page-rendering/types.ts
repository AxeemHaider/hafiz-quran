// PROTOTYPE (ticket #6).
import type { SkTypefaceFontProvider } from '@shopify/react-native-skia';

import type { FontName, Page, Unit } from './data';
import type { Stats } from './layout';

export type VariantProps = {
  page: Page;
  W: number;
  H: number;
  font: FontName;
  fontMgr: SkTypefaceFontProvider;
  tight: boolean;
  showBoxes: boolean;
  selected: string | null;
  onSelect: (u: Unit | null) => void;
  onStats: (page: number, s: Stats) => void;
};
