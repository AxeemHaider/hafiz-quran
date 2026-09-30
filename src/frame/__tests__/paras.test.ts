import { paraAt } from '../paras';

describe('Para lookup', () => {
  test('a word inside a Para gives that Para number and its name', () => {
    // Printed Page 401 opens in Surah Ya-Sin 36:54, inside Para 23 (وما لی), as in the Taj reference Page.
    expect(paraAt('36:54:1')).toEqual({ number: 23, name: 'وما لی' });
  });

  test('a Para starts at its opening Ayah and the Ayah before still belongs to the previous Para', () => {
    expect(paraAt('1:1:1').number).toBe(1);
    expect(paraAt('2:141:9').number).toBe(1);
    expect(paraAt('2:142:1').number).toBe(2);
    expect(paraAt('36:21:4').number).toBe(22);
    expect(paraAt('36:22:1').number).toBe(23);
    expect(paraAt('77:50:1').number).toBe(29);
    expect(paraAt('78:1:1').number).toBe(30);
    expect(paraAt('114:6:3')).toEqual({ number: 30, name: 'عم' });
  });

  test('every one of the 30 Paras is reachable from its opening Ayah, in order', () => {
    // IndoPak (Taj) starts, each at the top of a Taj Page; they differ from the Madani ones at Paras 4, 7,
    // 11, 14, 20, 21 and 23.
    const starts = [
      '1:1', '2:142', '2:253', '3:92', '4:24', '4:148', '5:83', '6:111', '7:88', '8:41',
      '9:94', '11:6', '12:53', '15:2', '17:1', '18:75', '21:1', '23:1', '25:21', '27:60',
      '29:45', '33:31', '36:22', '39:32', '41:47', '46:1', '51:31', '58:1', '67:1', '78:1',
    ];
    expect(starts.map((s) => paraAt(`${s}:1`).number)).toEqual(starts.map((_, i) => i + 1));
  });

  test('IndoPak Paras whose start differs from the Madani Mushaf begin where their name does', () => {
    expect(paraAt('3:91:1').number).toBe(3);
    expect(paraAt('3:92:1')).toEqual({ number: 4, name: 'لن تنالوا' });
    expect(paraAt('9:93:1').number).toBe(10);
    expect(paraAt('9:94:1')).toEqual({ number: 11, name: 'یعتذرون' });
    expect(paraAt('15:1:1').number).toBe(13);
    expect(paraAt('15:2:1')).toEqual({ number: 14, name: 'ربما' });
    expect(paraAt('27:59:1').number).toBe(19);
    expect(paraAt('27:60:1')).toEqual({ number: 20, name: 'امن خلق' });
    expect(paraAt('29:44:1').number).toBe(20);
    expect(paraAt('29:45:1')).toEqual({ number: 21, name: 'اتل ما اوحی' });
  });

  test('a location that is not surah:ayah:word fails loudly', () => {
    expect(() => paraAt('')).toThrow(/location/);
    expect(() => paraAt('115:1:1')).toThrow(/location/);
  });
});
