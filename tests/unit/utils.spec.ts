import { PublicKey } from '@solana/web3.js';
import expect from 'expect';

import { numToPaddedHex, pubKeyToHex } from '../../src/utils';

describe('Utils', () => {
  it('numToPaddedHex works', async function () {
    const cases = new Map([
      [0, '0000000000000000'],
      [1, '0000000000000001'],
      [10, '000000000000000a'],
      [15, '000000000000000f'],
    ]);
    for (const [num, hex] of cases.entries()) {
      expect(numToPaddedHex(num)).toEqual(hex);
    }
  });

  it('pubKeyToHex works', async function () {
    const cases = new Map([
      [
        '4yPPvFPy6myWqxTim7inAG71yHRvGhgkQTjYLcXLToXJ',
        '0x3b04e889bf5ee0b45846c939abc4f92cf8f0fb92f565a56f7da0b133b5592195',
      ],
      [
        'B8wA1YaUFz3cxYoB7uqK9v2V7FjkkdSyDwTWp7EZz5fW',
        '0x969d2b26a9d482072c01763fe77589c5725f315765d04cd10db60451febc3751',
      ],
      [
        '8Np3PNwLfytdgjx57Bp3rhPrKjcTW3ExnE1g33Quv7bp',
        '0x6d9831ef3067ae8bc6afb7f2272c52901e8d9209004971d72e246ea291cb2e23',
      ],
      [
        'EGHaCy8m6AMn4CY6oHi5YZRK9BrmGsbDvst66A63SzR6',
        '0xc512617b7a060232a8eba9941fd26418babe86be4b3c4553753078dd24e43661',
      ],
      [
        'G5j33ePDCSZddCogbXqffse9aMrj5684EXJHWfXB7W8K',
        '0xe01528146c7b580018be6bcfaf1d3ca0deb2e145abf912f8a4a82eec6e399f0c',
      ],
    ]);
    for (const [pubKey, hex] of cases.entries()) {
      expect(pubKeyToHex(new PublicKey(pubKey))).toEqual(hex);
    }
  });
});
