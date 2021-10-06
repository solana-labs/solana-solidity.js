import { PublicKey } from '@solana/web3.js';

export function encodeSeeds(seeds: any[]): Buffer {
  let seedEncoded = Buffer.alloc(
    1 + seeds.map((seed) => seed.seed.length + 1).reduce((a, b) => a + b, 0)
  );

  seedEncoded.writeUInt8(seeds.length);
  let offset = 1;

  seeds.forEach((v) => {
    let seed = v.seed;

    seedEncoded.writeUInt8(seed.length, offset);
    offset += 1;
    seed.copy(seedEncoded, offset);
    offset += seed.length;
  });

  return seedEncoded;
}

export function pubKeyToHex(publicKey: PublicKey): string {
  return '0x' + publicKey.toBuffer().toString('hex');
}

export function numToPaddedHex(num: number) {
  const str = num.toString(16);
  const pad = 16 > str.length ? '0'.repeat(16 - str.length) : '';
  return pad + str;
}
