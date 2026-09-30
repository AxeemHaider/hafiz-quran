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

## metadata/  (QUL quran-metadata, fetched 2026-10-01 while logged in)
| file | QUL | size (zip) | rows |
|---|---|---|---|
| quran-metadata-ruku.sqlite / .json | quran-metadata/65 (Ruku) | 32 KB (10 KB) / 82 KB (12 KB) | 558 |

Schema: `ruku(ruku_number, surah_ruku_number, verses_count, first_verse_key, last_verse_key, verse_mapping)`; keys are `surah:ayah`, `verse_mapping` is JSON like `{"2":"8-20"}`. No page or Para field.
Cross-check against the ruku marker U+06E0 in `indopak-nastaleeq.db`: every marker sits on a `last_verse_key`; 6 ruku ends carry no marker (3:171, 7:206, 16:50, 25:60, 53:62, 96:19; all but 3:171 are sajda ayahs).

## Join
```sql
attach 'scripts/indopak-nastaleeq.db' as s;
select p.line_number, (select group_concat(text,' ') from s.words w where w.id between p.first_word_id and p.last_word_id)
from pages p where page_number = 400 order by line_number;  -- = printed Taj p.401, matches docs/QuranPage.jpg
```
