// PROTOTYPE (throwaway, ticket #6). Copies QUL page data + fonts from the git-excluded
// sandbox into src/prototype/page-rendering/local/ (git-ignored: licences unresolved, see #8).
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';

const qul = 'sandbox/qul';
const out = 'src/prototype/page-rendering/local';
const pages = [396, 397, 398, 399, 400, 401, 402, 403, 404];
mkdirSync(out, { recursive: true });

const sql = `attach '${qul}/scripts/indopak-nastaleeq.db' as s;
attach '${qul}/scripts/digital-khatt-indopak.db' as dk;
select p.page_number, p.line_number, p.line_type, p.is_centered, p.surah_number,
  coalesce((select json_group_array(json_array(w.id, w.location, w.text, (select d.text from dk.words d where d.id = w.id))) from s.words w
    where p.line_type = 'ayah' and w.id between p.first_word_id and p.last_word_id), '[]')
from pages p where page_number in (${pages.join(',')}) order by page_number, line_number;`;
const rows = JSON.parse(
  execFileSync('sqlite3', ['-json', `${qul}/layouts/taj-indopak-16-lines.db`, sql]).toString(),
);
const byPage = new Map();
for (const r of rows) {
  const [page, line, type, centered, surah, words] = Object.values(r);
  if (!byPage.has(page)) byPage.set(page, { page, lines: [] });
  byPage.get(page).lines.push({
    line,
    type,
    centered: centered === 1,
    surah,
    words: JSON.parse(words).map(([id, loc, text, dk]) => ({ id, loc, text, dk })),
  });
}
writeFileSync(`${out}/pages.json`, JSON.stringify([...byPage.values()]));
for (const f of ['B-hanafi-normal.ttf', 'B-hanafi-compact.ttf', 'B-hanafi-compressed.ttf', 'D-digitalkhatt-indopak.otf'])
  copyFileSync(`${qul}/fonts/${f}`, `${out}/${f}`);
copyFileSync('docs/QuranPage.jpg', `${out}/reference-p401.jpg`);
console.log(`wrote ${byPage.size} pages to ${out}`);
