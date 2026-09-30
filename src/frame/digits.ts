/** Extended Arabic-Indic digit zero (U+06F0): the Urdu digits, as the Taj print uses. */
const URDU_ZERO = 0x06f0;

/** `n` written in Urdu/Eastern Arabic digits, e.g. 401 → ۴۰۱. */
export function toUrduDigits(n: number): string {
  return String(n).replace(/[0-9]/g, (d) => String.fromCharCode(URDU_ZERO + Number(d)));
}
