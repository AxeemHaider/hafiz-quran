# QUL sandbox (committed to the repo)

Fetched 2026-09-29 for wayfinder ticket #5 (map #1). Downloaded from QUL while logged in; fonts from QUL's public CDN.
Licences unresolved (see #8). The files are committed for convenience by the maintainer's choice; confirm the licences before shipping them in a published app.

## layouts/  (SQLite, unzipped from QUL downloads)
| file | QUL | db size (zip) | pages | `pages` rows |
|---|---|---|---|---|
| taj-indopak-16-lines.db | mushaf-layout/11 | 233 KB (98 KB) | 548 | 8742 (ayah 8598, surah_name 114, basmallah 30) |
| qudratullah-indopak-15-lines.db | mushaf-layout/12 | 242 KB (100 KB) | 610 | 9131 (ayah 8905, surah_name 114, basmallah 112) |

Schema (identical): `pages(page_number, line_number, line_type, is_centered, first_word_id, last_word_id, surah_number)`, `info(name, number_of_pages, lines_per_page, font_name)`; `font_name` = `indopak-nastaleeq` for both.
Non-ayah rows hold '' in word-id columns. Ayah word ranges are contiguous 1..83668, no gaps/overlaps.

## scripts/  (SQLite)
| file | QUL | db size (zip) | rows |
|---|---|---|---|
| indopak-nastaleeq.db | quran-script/59 (WBW) | 3.5 MB (1.6 MB) | 83668 |
| digital-khatt-indopak.db | quran-script/565 (WBW, fallback font) | 3.5 MB (1.6 MB) | 83668 |

Schema: `words(id, location, surah, ayah, word, text)`; `id` = layout word id. Same id→location in both scripts.

## fonts/  (QUL CDN, no login)
A-preview-waqf-lazim.woff2 (83 KB) · B-hanafi-{normal,compact,compressed}.ttf (300–311 KB) · B-hanafi-normal.woff2 (79 KB) · C-kfgqpc-nastaleeq.ttf (255 KB) · D-digitalkhatt-indopak.otf (495 KB)

## Join
```sql
attach 'scripts/indopak-nastaleeq.db' as s;
select p.line_number, (select group_concat(text,' ') from s.words w where w.id between p.first_word_id and p.last_word_id)
from pages p where page_number = 400 order by line_number;  -- = printed Taj p.401, matches docs/QuranPage.jpg
```
