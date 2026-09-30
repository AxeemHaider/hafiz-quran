// Mushaf data prep (spec #10, ticket #12).
//
// Turns the QUL downloads into the app's bundled Mushaf data:
//   <out>/mushaf.db   prepared SQLite database (schema below)
//   <out>/mushaf.ttf  the font the em widths and ink height were measured with
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
//         last_word_id, word_count, width_em)   -- one row per Line; width_em only for 'ayah' Lines
//   words(id, page_number, line_number, position, location, text)   -- 'ayah' Line words, in order
import * as hb from 'harfbuzzjs';
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { parseArgs } from 'node:util';

/** What the Taj 16-line Mushaf Layout must contain. */
const EXPECTED = { pages: 548, firstWordId: 1, lastWordId: 83668 };
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

function fail(problems) {
  const shown = problems.slice(0, 20);
  if (problems.length > shown.length) shown.push(`... and ${problems.length - shown.length} more`);
  console.error(`prepare-mushaf: FAILED, nothing written.\n  - ${shown.join('\n  - ')}`);
  process.exit(1);
}

const missing = [layoutFile, scriptFile, fontFile].filter((f) => !existsSync(f));
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

/** Shapes words with HarfBuzz: advance width and ink extent in em. */
function makeShaper(fontBytes) {
  const face = new hb.Face(new hb.Blob(fontBytes));
  const font = new hb.Font(face);
  const upem = face.upem;
  const extents = new Map();
  return (text) => {
    const buf = new hb.Buffer();
    buf.addText(text);
    buf.guessSegmentProperties();
    hb.shape(font, buf);
    const infos = buf.getGlyphInfos();
    const positions = buf.getGlyphPositions();
    let advance = 0;
    let top = -Infinity;
    let bottom = Infinity;
    infos.forEach((g, i) => {
      const p = positions[i];
      advance += p.xAdvance;
      if (!extents.has(g.codepoint)) extents.set(g.codepoint, font.glyphExtents(g.codepoint));
      const e = extents.get(g.codepoint);
      if (!e || e.height === 0) return;
      top = Math.max(top, p.yOffset + e.yBearing);
      bottom = Math.min(bottom, p.yOffset + e.yBearing + e.height);
    });
    return { width: advance / upem, top: top / upem, bottom: bottom / upem };
  };
}

const percentile = (values, p) => {
  const sorted = Float64Array.from(values).sort();
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
};

function writeDatabase(file, info, lines, words, shape) {
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
      text text not null);
    create index words_by_line on words (page_number, line_number, position);`);
  const insertLine = db.prepare('insert into lines values (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertWord = db.prepare('insert into words values (?, ?, ?, ?, ?, ?)');
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
      width += m.width;
      tops.push(m.top);
      bottoms.push(m.bottom);
      insertWord.run(id, l.page_number, l.line_number, count + 1, w.location, w.text);
    }
    insertLine.run(
      l.page_number, l.line_number, l.line_type, l.is_centered ? 1 : 0,
      l.line_type === 'surah_name' ? l.surah_number : null,
      isAyah ? l.first_word_id : null, isAyah ? l.last_word_id : null, count, width,
    );
  }
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
const problems = validate(info, lines, words);
if (problems.length) fail(problems);

mkdirSync(outDir, { recursive: true });
const tmp = join(outDir, 'mushaf.db.tmp');
rmSync(tmp, { force: true });
const ink = writeDatabase(tmp, info, lines, words, makeShaper(readFileSync(fontFile)));
renameSync(tmp, join(outDir, 'mushaf.db'));
copyFileSync(fontFile, join(outDir, 'mushaf.ttf'));

const em = (n) => n.toFixed(3);
console.log(
  `prepare-mushaf: ${info.name}: ${lines.length} Lines on ${EXPECTED.pages} Pages, font ${basename(fontFile)}, ` +
    `ink ${em(ink.inkBottom)}..${em(ink.inkTop)} = ${em(ink.inkTop - ink.inkBottom)} em -> ${outDir}`,
);
