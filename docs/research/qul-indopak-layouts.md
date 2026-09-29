# QUL Indopak 16-line (Taj) and 15-line (Qudratullah) Mushaf Layouts

Research for issue #2. Checked 2026-09-29 against the live QUL site (https://qul.tarteel.ai) and QUL's open-source code (github.com/TarteelAI/quranic-universal-library, MIT, commit `b91daf9`).

**Not verified directly:** the download files, because every QUL download needs a signed-in account (see [Access and licence](#access-and-licence)). The schema below comes from QUL's own exporter source and docs, and the line contents come from QUL's page preview, which renders the same database rows the exporter reads.

## TL;DR

- Both layouts are **SQLite** files, with **docx** as a second format (15-line also offers **images**). They share one schema: a `pages` table with one row per line (`page_number, line_number, line_type, is_centered, first_word_id, last_word_id, surah_number`) plus an `info` table.
- `line_type` is one of `surah_name`, `basmallah` or `ayah`. Only `ayah` lines carry a word range.
- The word ranges point at `word_index`, a single running number over every word in the Quran, ayah-end markers included. Both layouts use the word text **`text_indopak_nastaleeq`**, published as the QUL resource "Indopak Nastaleeq script – Word by Word" (quran-script/59). That text needs the "Indopak Nastaleeq" font (font/242).
- **16-line: 548 pages. 15-line: 610 pages.**
- **Line-for-line match confirmed:** all 16 lines of `docs/QuranPage.jpg` (printed page 401) match **QUL page 400**. QUL's page numbers run **one lower** than the printed Taj page numbers, at least at this page.
- The layouts contain no ruku, juz/para or sajda fields. The ayah-end words carry the **waqf marks** and a **ruku marker** inside the text. Ruku (558), Juz, Hizb, Rub, Manzil and Sajda come as separate QUL "Quran metadata" resources.
- Downloads require login. None of the three resources has a copyright notice ("We don't have copyright information for this resource."). The FAQ says commercial use is allowed but tells you to check each resource's licence.

## Resources

| | 16-line (Taj Company) | 15-line (Qudratullah) |
|---|---|---|
| QUL page | https://qul.tarteel.ai/resources/mushaf-layout/11 | https://qul.tarteel.ai/resources/mushaf-layout/12 |
| Description on QUL | "Indopak 16 lines layout published by Taj Company. This layout has 548 pages." | "…Mushaf published by Qudratullah Company based in Lahore Pakistan. This layout has 610 pages and 15 lines per page." |
| Pages | 548 | 610 |
| Downloads | sqlite, docx | sqlite, docx, images |
| Internal `mushafs.id` | 7 | 6 |
| Source scan QUL used (`Mushaf#pdf_url`) | archive.org/details/AlQuranAlKareem16LinesTajCompany | archive.org/details/AlQuran15LinesQudratullah |

Sources: the resource pages; `app/models/mushaf.rb` (`pdf_url`, `text_type_method`).

## File format and schema

The exporter is `lib/exporter/export_mushaf_layout.rb`.

### SQLite, table `pages` (one row per line)

| column | type | meaning |
|---|---|---|
| `page_number` | INTEGER | 1..548 or 1..610 |
| `line_number` | INTEGER | 1..16 or 1..15 (the row's position among the page's lines) |
| `line_type` | TEXT | `surah_name` \| `basmallah` \| `ayah` |
| `is_centered` | INTEGER 0/1 | 1 if the line's alignment record says centred, **and always 1 for `surah_name` and `basmallah`**. 0 means justified. |
| `first_word_id` | INTEGER | `ayah` lines only: the smallest `word_index` on the line. Empty string for other line types. |
| `last_word_id` | INTEGER | `ayah` lines only: the largest `word_index` on the line |
| `surah_number` | INTEGER | `surah_name` lines only. Empty for other line types. |

For non-`ayah` lines the exporter writes `''` (an empty string), not NULL, into the unused columns, so reading code should handle both.

### SQLite, table `info`

`name TEXT, number_of_pages INTEGER, lines_per_page INTEGER, font_name TEXT`

### JSON

The exporter also has an `export_json` method (added for QUL issue #257). It writes an `info.json` file and one `<page>.json` file per page, shaped like `{page, lines: {"1": {type, alignment: "centered"|"justified", first_word_id, last_word_id, data: [word texts…]} | {type:"surah_name", surah_number}}}`. **The layout 11 and 12 pages currently offer no JSON download**, only sqlite/docx(/images).

### docx

One `.docx` per page, one paragraph per line, justified or centred. It holds text only, with no ids.

### How the layouts differ

**There is no difference in shape.** One exporter produces both, with the same tables and columns. Only the data differs (15 vs 16 lines per page, 610 vs 548 pages). Both use the same word text (see below).

## Word text source and encoding

- `Mushaf#text_type_method` returns `text_indopak_nastaleeq` for any mushaf whose name contains "indopak". `Word::MUSHAF_TO_TEXT_ATTR_MAPPING` maps mushafs 6 and 7 to `text_indopak_nastaleeq`. When a word's `text_indopak_nastaleeq` changes, QUL pushes the new text to mushafs `[6, 7, 8, 17]`, so the layouts and the script stay in sync.
- The matching download is **"Indopak Nastaleeq script – Word by Word"** (https://qul.tarteel.ai/resources/quran-script/59), available as json and sqlite. Its related resource is the **Indopak Nastaleeq font** (https://qul.tarteel.ai/resources/font/242). It is *not* the "Indopak" (PDMS, `text_indopak`) script or the Digital Khatt Indopak script (565/566).
- Script schema (`lib/exporter/export_quran_word_script.rb`): table `words(id INTEGER, location TEXT, surah INTEGER, ayah INTEGER, word INTEGER, text TEXT)`. Here **`id` = `word_index`**, the key the layout's `first_word_id`/`last_word_id` point at. QUL's docs page calls this column `word_index` with `word_key`, but the exporter code names it `id` and `location`, so check the downloaded file. The JSON form is keyed by location: `{"1:1:1": {id, surah, ayah, word, location, text}}`.
- Every word row is exported, ayah-end markers included (`Word.unscoped.order('word_index asc')`). An `ayah` line's range therefore covers the ayah-end glyphs too.
- **Encoding** (read from the rendered page-400 text):
  - Letters are Unicode Arabic with Urdu-style forms such as ی (U+06CC) and the small high marks used in Indopak script.
  - Each **ayah-end word** is `U+06DF` (small high rounded zero), then any waqf/ruku marks, then **one Private Use Area codepoint for the ayah number: U+F4FF + ayah number**. For example ayah 4 is U+F503 and ayah 54 is U+F535. The ayah number displays correctly only with QUL's Indopak Nastaleeq font.
  - Waqf marks seen inside end words: U+06DA (ۚ jeem), U+06D6 (ۖ), U+06D9 (ۙ lam-alif), U+0615, and others such as ؕ.
  - The **ruku marker is U+06E0** (۠). On page 400 it appears only at the end of 36:67 (`۟۠`), which is exactly where the printed page has its ع ruku sign.
- The page preview's `data-word-id` attribute is QUL's internal `Word.id`, not `word_index` (2:1:1 shows `data-word-id=11`). Do not use preview ids as layout ids.

## Page 401 check against `docs/QuranPage.jpg`

The reference image has the printed number **401** (Yasin, para وما لي 23). It matches **QUL 16-line page 400** line for line. QUL page 401 starts mid-36:72 with یَاْكُلُوْنَ.

| line | QUL first..last word | printed line ends with | match |
|---|---|---|---|
| 1 | 36:54:2 .. 36:55:2 | …اِنَّ اَصْحٰبَ | yes |
| 2 | 36:55:3 .. 36:56:5 | …ظِلٰلٍ عَلَی | yes |
| 3 | 36:56:6 .. 36:57 end | …یَدَّعُوْنَ ۝ | yes |
| 4 | 36:58:1 .. 36:59 end | …الْمُجْرِمُوْنَ ۝ | yes |
| 5 | 36:60:1 .. 36:60:11 | …اِنَّهٗ لَكُمْ | yes |
| 6 | 36:60:12 .. 36:62:1 | …وَلَقَدْ | yes |
| 7 | 36:62:2 .. 36:63:2 | …هٰذِهٖ جَهَنَّمُ | yes |
| 8 | 36:63:3 .. 36:65:1 | …اَلْیَوْمَ | yes |
| 9 | 36:65:2 .. 36:65:9 | …اَرْجُلُهُمْ بِمَا | yes |
| 10 | 36:65:10 .. 36:66:7 | …فَاسْتَبَقُوا الصِّرَاطَ | yes |
| 11 | 36:66:8 .. 36:67:7 | …فَمَا اسْتَطَاعُوْا | yes |
| 12 | 36:67:8 .. 36:68:6 | …اَفَلَا (ruku marker at end of 67) | yes |
| 13 | 36:68:7 .. 36:69:10 | …اِلَّا ذِكْرٌ | yes |
| 14 | 36:69:11 .. 36:70:7 | …الْقَوْلُ عَلَی | yes |
| 15 | 36:70:8 .. 36:71:9 | …اَیْدِیْنَاۤ اَنْعَامًا | yes |
| 16 | 36:71:10 .. 36:72:5 | …وَمِنْهَا | yes |

All 16 lines are `ayah` lines with no centred lines. Line 1 starts لَا تُظْلَمُ نَفْسٌ شَیْـًٔا (36:54:2) and line 16 ends وَمِنْهَا (36:72:5), as the ticket expects.

**Implication:** QUL's page numbers are not the printed page numbers. At page 401 the offset is −1. This matters for the glossary's "**Page**: identified by its printed page number". Whether the offset is constant across all 548 pages (for example, a printed page 1 before Al-Fatiha) is **not verified**.

## Ruku / waqf / sajda / para (juz)

- **In the layout:** none. The only columns are page, line, type, centring and word range.
- **In the word text:** waqf marks and the ruku marker (U+06E0) sit inside the ayah-end words, as shown above. Page-400 end words confirm this for 16-line. The 15-line layout uses the same text, so it carries the same marks.
- **Separate QUL "Quran metadata" resources** (https://qul.tarteel.ai/resources/quran-metadata), each downloadable as sqlite/json: Ruku (65, **558 rukus**, the Indopak count), Juz (68), Hizb (67), Rub (63), Manzil (66), Sajda (64), Surah names (70), Ayah (69). These are keyed by ayah, not by page.
- Frame details such as the margin ruku counters (ع with numbers), para name and page-header surah name are **not** in the layout. The app would have to derive them from the metadata and the page's word range.

## Access and licence

- **Login required:** every download button opens a sign-in modal (`data-url=/users/sign_in…`). In code, `ResourcesController` has `before_action :authenticate_user!, only: [:download]`, and an unauthenticated `GET /resources/11/<token>/download` returns **302 to `/users/sign_in`**. No account was created for this research.
- **File sizes: unknown**, because they are not shown without login. A rough estimate: about 8.8k rows (16-line) or about 9.2k rows (15-line) of small integers, so a few hundred KB. The word script has about 83k rows.
- **Licence:** the `/resources/{11,12,59}/copyright` pages say "We don't have copyright information for this resource." The QUL FAQ says QUL data may be used commercially but tells readers to "review the licensing terms for each resource". The QUL code repository is MIT, but that covers the code, not the data. The underlying print layouts belong to Taj Company and Qudratullah.

## Unresolved

1. Exact file sizes, and whether the downloaded `words` table uses `id` or `word_index` as its column name. Both need a logged-in download.
2. Whether the printed-to-QUL page offset of −1 holds for all pages.
3. Whether 15-line page lines match a printed Qudratullah page. No reference image was available.
4. The licence position for redistributing the layout data inside an app. QUL publishes no notice, so ask QUL/Tarteel.

## Sources

- https://qul.tarteel.ai/resources/mushaf-layout/11 and `/12` (description, downloads, page preview, pages 1, 400, 401)
- https://qul.tarteel.ai/docs/mushaf-layout (schema, rendering algorithm)
- https://qul.tarteel.ai/docs/indopak
- https://qul.tarteel.ai/resources/quran-script/59, https://qul.tarteel.ai/resources/quran-metadata/65
- https://qul.tarteel.ai/faq
- QUL source: `lib/exporter/export_mushaf_layout.rb`, `lib/exporter/export_quran_word_script.rb`, `app/models/mushaf.rb`, `app/models/word.rb`, `app/controllers/resources_controller.rb`, `app/views/resources/previews/_mushaf_layout.html.erb`, `app/views/docs/markdown/tutorial-mushaf-layout-end-to-end.md`
