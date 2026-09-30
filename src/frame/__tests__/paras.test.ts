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
    const starts = [
      '1:1', '2:142', '2:253', '3:93', '4:24', '4:148', '5:83', '6:111', '7:88', '8:41',
      '9:93', '11:6', '12:53', '15:1', '17:1', '18:75', '21:1', '23:1', '25:21', '27:56',
      '29:46', '33:31', '36:22', '39:32', '41:47', '46:1', '51:31', '58:1', '67:1', '78:1',
    ];
    expect(starts.map((s) => paraAt(`${s}:1`).number)).toEqual(starts.map((_, i) => i + 1));
  });

  test('a location that is not surah:ayah:word fails loudly', () => {
    expect(() => paraAt('')).toThrow(/location/);
    expect(() => paraAt('115:1:1')).toThrow(/location/);
  });
});
