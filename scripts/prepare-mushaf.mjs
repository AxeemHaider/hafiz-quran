// Mushaf data prep (spec #10, ticket #12).
//
// Turns the QUL downloads into the app's bundled Mushaf data:
//   <out>/mushaf.db   prepared SQLite database (schema below)
//   <out>/mushaf.ttf  the font the em widths and ink height were measured with
// It also reads the QUL ruku metadata (<qul>/metadata/quran-metadata-ruku.sqlite) for the margin's
// ruku signs, numbered by src/frame/ruku-signs.ts (imported as TypeScript: Node's type stripping).
// Default <out> is assets/generated/mushaf/ (git-ignored: QUL licences unresolved, see #8).
//
// Run:   npm run prepare:mushaf
// Input: the git-excluded QUL sandbox (sandbox/qul/, see its README). Override its location with
//        QUL_DIR=/path/to/sandbox/qul or --qul <dir> (agents in a worktree point at the main checkout).
// Font:  <qul>/fonts/B-hanafi-normal.ttf by default. Swap it with MUSHAF_FONT=<file> or --font <file>
//        and re-run: widths and ink height are re-measured with the new font.
// Needs Node >= 22.13 (node:sqlite).
//
// Fails loudly, writing nothing, if the data is wrong. Output schema:
//   mushaf(name, number_of_pages, lines_per_page, font_name, ink_top_em, ink_bottom_em, ink_height_em)
//   lines(page_number, line_number, line_type, is_centered, surah_number, first_word_id,
//         last_word_id, word_count, width_em)   -- one row per Line; width_em only for 'ayah' Lines,
//                                                  the sum of its words' advances and ink overhangs
//   words(id, page_number, line_number, position, location, text, ink_left_em, ink_right_em)
//         -- 'ayah' Line words, in order; ink_*_em is how far the word's ink reaches past its
//            advance on that side (>= 0), e.g. waqf marks after a space hang up to ~0.4 em left
//   ruku_signs(page_number, line_number, in_surah, ayah_count, in_para)
//         -- one row per ruku, on the Line holding its last word: its number in its surah, its Ayah
//            count, and its number in the Para it ends in
import * as hb from 'harfbuzzjs';
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { basename, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

/**
 * Lets Node import the app's TypeScript modules as Metro resolves them: `@/` is `src/`, and relative
 * imports inside a .ts module leave out the extension.
 */
const SRC = fileURLToPath(new URL('../src/', import.meta.url));
registerHooks({
  resolve(specifier, context, nextResolve) {
    const base = specifier.startsWith('@/')
      ? join(SRC, specifier.slice(2))
      : specifier.startsWith('.') && context.parentURL?.endsWith('.ts')
        ? fileURLToPath(new URL(specifier, context.parentURL))
        : null;
    const resolved = nextResolve(base && existsSync(`${base}.ts`) ? pathToFileURL(`${base}.ts`).href : specifier, context);
    return resolved.url.endsWith('.ts') ? { ...resolved, format: 'module-typescript' } : resolved;
  },
});
const { rukuSigns } = await import('../src/frame/ruku-signs.ts');

/** What the Taj 16-line Mushaf Layout must contain. */
const EXPECTED = { pages: 548, firstWordId: 1, lastWordId: 83668, rukus: 558 };
const SURAH_COUNT = 114;
const LINE_TYPES = new Set(['ayah', 'surah_name', 'basmallah']);
/**
 * Ink height statistic: the 99.5th percentile of each word's ink top and the 0.5th percentile of
 * its ink bottom, over the whole script, so a handful of outlier marks don't set the Line pitch.
 */
const INK_PERCENTILE = 0.995;

const { values: args } = parseArgs({
  options: { qul: { type: 'string' }, font: { type: 'string' }, out: { type: 'string' } },
});
const qul = resolve(args.qul ?? process.env.QUL_DIR ?? 'sandbox/qul');
const fontFile = resolve(args.font ?? process.env.MUSHAF_FONT ?? join(qul, 'fonts/B-hanafi-normal.ttf'));
const outDir = resolve(args.out ?? 'assets/generated/mushaf');
const layoutFile = join(qul, 'layouts/taj-indopak-16-lines.db');
const scriptFile = join(qul, 'scripts/indopak-nastaleeq.db');
const rukuFile = join(qul, 'metadata/quran-metadata-ruku.sqlite');

function fail(problems) {
  const shown = problems.slice(0, 20);
  if (problems.length > shown.length) shown.push(`... and ${problems.length - shown.length} more`);
  console.error(`prepare-mushaf: FAILED, nothing written.\n  - ${shown.join('\n  - ')}`);
  process.exit(1);
}

const missing = [layoutFile, scriptFile, rukuFile, fontFile].filter((f) => !existsSync(f));
if (missing.length)
  fail(missing.map((f) => `missing input ${f} (set QUL_DIR / --qul, or MUSHAF_FONT / --font)`));

/** QUL writes '' into unused columns; treat it as NULL. */
const blankToNull = (v) => (v === '' ? null : v);

function readLayout() {
  const db = new DatabaseSync(layoutFile, { readOnly: true });
  const info = db.prepare('select name, number_of_pages, lines_per_page, font_name from info').get();
  const lines = db
    .prepare(
      `select page_number, line_number, line_type, is_centered, surah_number, first_word_id, last_word_id
       from pages order by page_number, line_number`,
    )
    .all()
    .map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, blankToNull(v)])));
  db.close();
  return { info, lines };
}

function readScript() {
  const db = new DatabaseSync(scriptFile, { readOnly: true });
  const words = new Map();
  for (const w of db.prepare('select id, location, text from words').iterate())
    words.set(Number(w.id), { location: w.location, text: w.text });
  db.close();
  return words;
}

function readRukus() {
  const db = new DatabaseSync(rukuFile, { readOnly: true });
  const rukus = db
    .prepare(
      `select ruku_number as rukuNumber, surah_ruku_number as surahRukuNumber, verses_count as versesCount,
         last_verse_key as lastVerseKey
       from ruku order by ruku_number`,
    )
    .all()
    .map((r) => ({ ...r }));
  db.close();
  return rukus;
}

/**
 * Each ruku's sign, on the Line holding the last word of its last Ayah, or the problems found.
 * Numbered from the metadata, not from the U+06E0 ruku mark in the text: 6 ruku ends have no mark.
 */
function makeRukuSigns(rukus, lines, words) {
  const lineOfWord = new Map();
  for (const l of lines)
    if (l.line_type === 'ayah')
      for (let id = l.first_word_id; id <= l.last_word_id; id++)
        lineOfWord.set(id, { pageNumber: l.page_number, lineNumber: l.line_number });
  const lastWordOfAyah = new Map();
  for (const [id, w] of words) {
    const ayah = w.location.split(':').slice(0, 2).join(':');
    lastWordOfAyah.set(ayah, Math.max(lastWordOfAyah.get(ayah) ?? 0, id));
  }
  const problems = [];
  if (rukus.length !== EXPECTED.rukus) problems.push(`expected ${EXPECTED.rukus} rukus, metadata has ${rukus.length}`);
  rukus.forEach((r, i) => {
    if (r.rukuNumber !== i + 1) problems.push(`ruku numbers skip: #${i + 1} is ${r.rukuNumber}`);
  });
  if (problems.length) return { problems };
  try {
    return { signs: rukuSigns(rukus, (key) => lineOfWord.get(lastWordOfAyah.get(key))), problems };
  } catch (e) {
    return { problems: [e.message] };
  }
}

/** Every problem with the layout + script, as messages. Empty means the data is good. */
function validate(info, lines, words) {
  const problems = [];
  const pages = new Map();
  for (const l of lines) pages.set(l.page_number, (pages.get(l.page_number) ?? 0) + 1);
  if (!info) problems.push('layout has no info row');
  if (pages.size !== EXPECTED.pages)
    problems.push(`expected ${EXPECTED.pages} Pages, layout has ${pages.size}`);
  if (info && Number(info.number_of_pages) !== pages.size)
    problems.push(`info.number_of_pages is ${info.number_of_pages} but layout has ${pages.size} Pages`);
  const perPage = Number(info?.lines_per_page);
  for (const [page, count] of pages)
    if (count > perPage) problems.push(`Page ${page} has ${count} Lines, more than ${perPage} per Page`);

  const seen = new Set();
  let expectNext = EXPECTED.firstWordId;
  for (const l of lines) {
    const at = `Page ${l.page_number} Line ${l.line_number}`;
    const key = `${l.page_number}:${l.line_number}`;
    if (seen.has(key)) problems.push(`${at} appears twice`);
    seen.add(key);
    if (!(l.line_number >= 1 && l.line_number <= perPage))
      problems.push(`${at}: Line number outside 1..${perPage}`);
    if (!LINE_TYPES.has(l.line_type)) problems.push(`${at}: unknown line_type '${l.line_type}'`);
    if (l.line_type === 'surah_name' && !(l.surah_number >= 1 && l.surah_number <= SURAH_COUNT))
      problems.push(`${at}: surah_name Line without a surah number`);
    if (l.line_type !== 'ayah') continue;
    const [first, last] = [l.first_word_id, l.last_word_id];
    if (first == null || last == null || last < first) {
      problems.push(`${at}: bad word range ${first}..${last}`);
      continue;
    }
    if (first > expectNext) problems.push(`${at}: gap, words ${expectNext}..${first - 1} are on no Line`);
    if (first < expectNext) problems.push(`${at}: overlap, words ${first}..${expectNext - 1} repeat`);
    expectNext = Math.max(expectNext, last + 1);
    for (let id = first; id <= last; id++)
      if (!words.has(id)) problems.push(`${at}: word id ${id} missing from the script`);
  }
  if (expectNext - 1 !== EXPECTED.lastWordId)
    problems.push(`ayah word ranges end at ${expectNext - 1}, expected ${EXPECTED.lastWordId}`);
  return problems;
}

/**
 * Private Use Area codepoints (the ayah numbers, some waqf signs) are strong left-to-right, so the
 * device's Paragraph shapes them as their own LTR run inside the RTL word. Shaping the word as one RTL
 * buffer would reverse them and misplace their marks.
 */
const PUA_RUNS = /([\uE000-\uF8FF]+)/u;

/**
 * Shapes words with HarfBuzz the way a Skia Paragraph does (runs split at PUA text, in RTL visual
 * order): advance width, ink top/bottom, and how far the ink reaches past the advance on the left
 * and right (>= 0), all in em. Waqf marks after a space hang left of the advance (`عَلَیْهِمْ ۙ۬ۦ`).
 */
function makeShaper(fontBytes) {
  const face = new hb.Face(new hb.Blob(fontBytes));
  const font = new hb.Font(face);
  const upem = face.upem;
  const extents = new Map();
  const shapeRun = (text, ltr) => {
    const buf = new hb.Buffer();
    buf.addText(text);
    buf.guessSegmentProperties();
    if (ltr) buf.setDirection(hb.Direction.LTR);
    hb.shape(font, buf);
    const positions = buf.getGlyphPositions();
    return buf.getGlyphInfos().map((g, i) => ({ glyph: g.codepoint, ...positions[i] }));
  };
  return (text) => {
    // Logical runs, laid out right to left: the visual order is the reverse.
    const glyphs = text
      .split(PUA_RUNS)
      .map((run, i) => (run ? shapeRun(run, i % 2 === 1) : []))
      .reverse()
      .flat();
    let advance = 0;
    let top = -Infinity;
    let bottom = Infinity;
    let left = 0;
    let right = 0;
    for (const g of glyphs) {
      if (!extents.has(g.glyph)) extents.set(g.glyph, font.glyphExtents(g.glyph));
      const e = extents.get(g.glyph);
      if (e && e.height !== 0) {
        top = Math.max(top, g.yOffset + e.yBearing);
        bottom = Math.min(bottom, g.yOffset + e.yBearing + e.height);
        const x = advance + g.xOffset + e.xBearing;
        left = Math.min(left, x, x + e.width);
        right = Math.max(right, x, x + e.width);
      }
      advance += g.xAdvance;
    }
    return {
      width: advance / upem,
      top: top / upem,
      bottom: bottom / upem,
      inkLeft: -left / upem,
      inkRight: Math.max(0, right - advance) / upem,
    };
  };
}

const percentile = (values, p) => {
  const sorted = Float64Array.from(values).sort();
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
};

function writeDatabase(file, info, lines, words, signs, shape) {
  const db = new DatabaseSync(file);
  db.exec(`
    create table mushaf (name text not null, number_of_pages integer not null,
      lines_per_page integer not null, font_name text not null, ink_top_em real not null,
      ink_bottom_em real not null, ink_height_em real not null);
    create table lines (page_number integer not null, line_number integer not null,
      line_type text not null check (line_type in ('ayah', 'surah_name', 'basmallah')),
      is_centered integer not null, surah_number integer, first_word_id integer,
      last_word_id integer, word_count integer not null, width_em real,
      primary key (page_number, line_number));
    create table words (id integer primary key, page_number integer not null,
      line_number integer not null, position integer not null, location text not null,
      text text not null, ink_left_em real not null, ink_right_em real not null);
    create index words_by_line on words (page_number, line_number, position);
    create table ruku_signs (page_number integer not null, line_number integer not null,
      in_surah integer not null, ayah_count integer not null, in_para integer not null);
    create index ruku_signs_by_page on ruku_signs (page_number, line_number);`);
  const insertLine = db.prepare('insert into lines values (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertWord = db.prepare('insert into words values (?, ?, ?, ?, ?, ?, ?, ?)');
  const tops = [];
  const bottoms = [];
  db.exec('begin');
  for (const l of lines) {
    const isAyah = l.line_type === 'ayah';
    let width = isAyah ? 0 : null;
    let count = 0;
    for (let id = l.first_word_id; isAyah && id <= l.last_word_id; id++, count++) {
      const w = words.get(id);
      const m = shape(w.text);
      width += m.width + m.inkLeft + m.inkRight;
      tops.push(m.top);
      bottoms.push(m.bottom);
      insertWord.run(id, l.page_number, l.line_number, count + 1, w.location, w.text, m.inkLeft, m.inkRight);
    }
    insertLine.run(
      l.page_number, l.line_number, l.line_type, l.is_centered ? 1 : 0,
      l.line_type === 'surah_name' ? l.surah_number : null,
      isAyah ? l.first_word_id : null, isAyah ? l.last_word_id : null, count, width,
    );
  }
  const insertSign = db.prepare('insert into ruku_signs values (?, ?, ?, ?, ?)');
  for (const s of signs) insertSign.run(s.pageNumber, s.lineNumber, s.inSurah, s.ayahCount, s.inPara);
  const inkTop = percentile(tops, INK_PERCENTILE);
  const inkBottom = percentile(bottoms, 1 - INK_PERCENTILE);
  db.prepare('insert into mushaf values (?, ?, ?, ?, ?, ?, ?)').run(
    info.name, Number(info.number_of_pages), Number(info.lines_per_page), info.font_name,
    inkTop, inkBottom, inkTop - inkBottom,
  );
  db.exec('commit');
  db.close();
  return { inkTop, inkBottom };
}

const { info, lines } = readLayout();
const words = readScript();
const { signs, problems: rukuProblems } = makeRukuSigns(readRukus(), lines, words);
const problems = [...validate(info, lines, words), ...rukuProblems];
if (problems.length) fail(problems);

mkdirSync(outDir, { recursive: true });
const tmp = join(outDir, 'mushaf.db.tmp');
rmSync(tmp, { force: true });
const ink = writeDatabase(tmp, info, lines, words, signs, makeShaper(readFileSync(fontFile)));
renameSync(tmp, join(outDir, 'mushaf.db'));
copyFileSync(fontFile, join(outDir, 'mushaf.ttf'));

const em = (n) => n.toFixed(3);
console.log(
  `prepare-mushaf: ${info.name}: ${lines.length} Lines on ${EXPECTED.pages} Pages, ${signs.length} ruku signs, font ${basename(fontFile)}, ` +
    `ink ${em(ink.inkBottom)}..${em(ink.inkTop)} = ${em(ink.inkTop - ink.inkBottom)} em -> ${outDir}`,
);
