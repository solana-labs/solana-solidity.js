import { JsonFragment } from '@ethersproject/abi';
import { PublicKey } from '@solana/web3.js';

export type Abi = JsonFragment[];

export type Seed = string | PublicKey | Uint8Array | Buffer;

export function seedToBuffer(seed: Seed): Buffer {
    if (seed instanceof Buffer) {
        return seed;
    } else if (typeof seed === 'string') {
        return Buffer.from(seed, 'utf-8');
    } else if (seed instanceof PublicKey) {
        return seed.toBuffer();
    } else {
        return Buffer.from(seed);
    }
}

export function encodeSeeds(seeds: Seed[]): Buffer {
    const buffers = seeds.map(seedToBuffer);

    let length = 1;
    for (const buffer of buffers) {
        length += buffer.length + 1;
    }

    const encoded = Buffer.alloc(length);
    encoded.writeUInt8(buffers.length);

    let offset = 1;
    for (const buffer of buffers) {
        encoded.writeUInt8(buffer.length, offset);
        offset += 1;
        buffer.copy(encoded, offset);
        offset += buffer.length;
    }

    return encoded;
}

export function pubKeyToHex(publicKey: PublicKey): string {
    return '0x' + publicKey.toBuffer().toString('hex');
}

export function numToPaddedHex(num: number) {
    const str = num.toString(16);
    const pad = 16 > str.length ? '0'.repeat(16 - str.length) : '';
    return pad + str;
}
