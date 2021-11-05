import { JsonFragment } from '@ethersproject/abi';
import { PublicKey } from '@solana/web3.js';
import { randomBytes } from 'crypto';

/** Application Binary Interface of a Solidity contract in JSON form */
export type ABI = JsonFragment[];

/** PDA and the seed used to derive it */
export interface ProgramDerivedAddress {
    address: PublicKey;
    seed: Buffer;
}

/**
 * Create a Program Derived Address from a program ID and a random seed
 *
 * @param program Program ID to derive the PDA using
 *
 * @return PDA and the seed used to derive it
 */
export async function createProgramDerivedAddress(program: PublicKey): Promise<ProgramDerivedAddress> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const seed = randomBytes(7);

        let address: PublicKey;
        try {
            [address] = await PublicKey.findProgramAddress([seed], program);
        } catch (error) {
            // If a valid PDA can't be found using the seed, generate another and try again
            continue;
        }

        return { address, seed };
    }
}

/**
 * Encode a public key as a hexadecimal string
 *
 * @param publicKey Public key to convert
 *
 * @return Hex-encoded public key
 */
export function publicKeyToHex(publicKey: PublicKey): string {
    return '0x' + publicKey.toBuffer().toString('hex');
}

/** @internal */
export type Seed = string | PublicKey | Uint8Array | Buffer;

/** @internal */
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

/** @internal */
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

/** @internal */
export function numToPaddedHex(num: number): string {
    const str = num.toString(16);
    const pad = 16 > str.length ? '0'.repeat(16 - str.length) : '';
    return pad + str;
}
