# Hafiz Quran

A Quran reader for huffaz who memorise from a fixed-line printed mushaf, where every word must sit on the same page and line as in print.

## Language

### Mushaf

**Mushaf**:
A specific printed edition of the Quran whose pages the app reproduces (e.g. Taj Company 16-line, Qudratullah 15-line).
_Avoid_: Quran edition, book

**Mushaf Layout**:
The data that fixes, for a Mushaf, which words fall on each Page and each Line.
_Avoid_: Page map, line data

**Page layout**:
The computed placement of one Page's words for a given text area and font (font size, Line positions, word boxes), done on the device (`src/layout/`). Derived from the Mushaf Layout; never changes which words are on a Line.
_Avoid_: Layout (alone, when the Mushaf Layout could be meant)

**Page**:
One page of a Mushaf, identified by its printed page number; always shown whole, never reflowed.
_Avoid_: Screen, spread

**Line**:
One of the fixed rows of a Page (15 or 16), starting and ending on a fixed word and stretched edge to edge.
_Avoid_: Row, text line

**Line Fidelity**:
The guarantee that every Line starts and ends on the same word as the printed Mushaf, on every device.
_Avoid_: Pixel-perfect, exact layout

**Page Frame**:
The decorative border and header (surah name, page number, para) surrounding a Page's Lines.
Within the Page Frame, "border" means its rules (the double-rule border around the Lines), not the whole frame.
_Avoid_: Chrome, border (for the whole frame)

### Quran structure

**Ayah**:
A single verse, closed on the Page by its numbered ayah-end marker.
_Avoid_: Verse (in code and docs)

**Para**:
One of the 30 traditional divisions of the Quran, named by its opening words (e.g. وما لي).
_Avoid_: Juz, Sipara

**Ruku**:
A thematic section within a surah, marked in the Page margin.

### People

**Hafiz**:
A person memorising or who has memorised the Quran; the app's primary user. Plural: huffaz.
_Avoid_: Hufaz, user (when the memoriser specifically is meant)
