import { PublicKey } from '@solana/web3.js';

export function pubKeyToHex(publicKey: PublicKey): string {
  return '0x' + publicKey.toBuffer().toString('hex');
}

export function numToPaddedHex(num: number) {
  const str = num.toString(16);
  const pad = 16 > str.length ? '0'.repeat(16 - str.length) : '';
  return pad + str;
}
