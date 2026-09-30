import { SURAH_COUNT } from '@/mushaf/surah-names';

export type Para = { number: number; name: string };

/**
 * The 30 Paras, in order: the Ayah each opens with (surah, ayah) and its name, the opening words as the
 * Taj Mushaf's header writes them. App-owned static data. IndoPak Para starts (each opens a Taj Page),
 * which differ from the Madani ones at Paras 4, 7, 11, 14, 20, 21 and 23.
 */
const PARAS: readonly (readonly [surah: number, ayah: number, name: string])[] = [
  [1, 1, 'الم'],
  [2, 142, 'سیقول'],
  [2, 253, 'تلک الرسل'],
  [3, 92, 'لن تنالوا'],
  [4, 24, 'والمحصنت'],
  [4, 148, 'لا یحب اللہ'],
  [5, 83, 'واذا سمعوا'],
  [6, 111, 'ولو اننا'],
  [7, 88, 'قال الملا'],
  [8, 41, 'واعلموا'],
  [9, 94, 'یعتذرون'],
  [11, 6, 'وما من دابۃ'],
  [12, 53, 'وما ابرئ'],
  [15, 2, 'ربما'],
  [17, 1, 'سبحن الذی'],
  [18, 75, 'قال الم'],
  [21, 1, 'اقترب للناس'],
  [23, 1, 'قد افلح'],
  [25, 21, 'وقال الذین'],
  [27, 60, 'امن خلق'],
  [29, 45, 'اتل ما اوحی'],
  [33, 31, 'ومن یقنت'],
  [36, 22, 'وما لی'],
  [39, 32, 'فمن اظلم'],
  [41, 47, 'الیہ یرد'],
  [46, 1, 'حم'],
  [51, 31, 'قال فما خطبکم'],
  [58, 1, 'قد سمع اللہ'],
  [67, 1, 'تبرک الذی'],
  [78, 1, 'عم'],
];

/** The Para a word at `location` (surah:ayah:word) falls in. Throws for a malformed location. */
export function paraAt(location: string): Para {
  const [surah, ayah] = location.split(':').map(Number);
  if (!(surah >= 1 && surah <= SURAH_COUNT && ayah >= 1)) throw new Error(`Bad word location "${location}"`);
  let index = 0;
  while (index + 1 < PARAS.length) {
    const [s, a] = PARAS[index + 1];
    if (surah < s || (surah === s && ayah < a)) break;
    index++;
  }
  return { number: index + 1, name: PARAS[index][2] };
}
