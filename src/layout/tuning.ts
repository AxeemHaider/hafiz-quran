/**
 * Tuning values for the Page layout. Defaults, not rules (ADR 0001): the font-specific ones (word gap,
 * vertical stretch, width cutoff) are re-tuned after a font swap; `maxPageWidth` is a screen-size cap
 * that no font swap changes. No other layout code holds font-specific constants.
 */
export type Tuning = {
  /** Gap between words, in em (fraction of the font size). */
  wordGapEm: number;
  /** Vertical stretch of every word around its Line's centre. Changes height only, never width. */
  verticalStretch: number;
  /** Lines longer than this (in em) don't set the Mushaf font size; their Pages shrink instead. */
  widthCutoffEm: number;
  /** Largest Page box width in dp; wider screens (tablets) centre a Page of this width. */
  maxPageWidth: number;
};

export const DEFAULT_TUNING: Tuning = {
  wordGapEm: 0,
  verticalStretch: 1.3,
  widthCutoffEm: 18,
  maxPageWidth: 600,
};
