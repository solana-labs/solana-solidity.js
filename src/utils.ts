import { PublicKey } from '@solana/web3.js';

export async function createProgramAddress(
  program: PublicKey,
  salt: Buffer
): Promise<{ address: PublicKey; seed: Buffer } | null> {
  for (let bump = 0; bump < 256; bump++) {
    const seed = Buffer.concat([salt, Uint8Array.from([bump])]);

    let pda: PublicKey | null = null;
    try {
      pda = await PublicKey.createProgramAddress([seed], program);
    } catch {}

    if (pda) {
      return { address: pda, seed };
    }
  }

  return null;
}

export function encodeSeeds(seeds: Buffer[]): Buffer {
  let seedEncoded = Buffer.alloc(
    1 + seeds.map((seed) => seed.length + 1).reduce((a, b) => a + b, 0)
  );

  seedEncoded.writeUInt8(seeds.length);
  let offset = 1;

  seeds.forEach((seed) => {
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
