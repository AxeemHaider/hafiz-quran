/**
 * The only module that touches the generated Mushaf folder (git-ignored, written by
 * `npm run prepare:mushaf`). Each `require` sits in its own try/catch, which makes it an optional
 * dependency for Metro: a fresh checkout still bundles, and the reader shows `missing` instead.
 * The paths must stay static string literals so Metro can resolve them.
 */
export type MushafAssets = { db: number; font: number } | { missing: string[] };

export const DATA_PREP_COMMAND = 'npm run prepare:mushaf';

function load(): MushafAssets {
  let db: number | undefined;
  let font: number | undefined;
  try {
    db = require('../../assets/generated/mushaf/mushaf.db');
  } catch {}
  try {
    font = require('../../assets/generated/mushaf/mushaf.ttf');
  } catch {}
  if (db !== undefined && font !== undefined) return { db, font };
  const missing: string[] = [];
  if (db === undefined) missing.push('mushaf.db');
  if (font === undefined) missing.push('mushaf.ttf');
  return { missing };
}

export const MUSHAF_ASSETS = load();
