import { Keypair } from '@solana/web3.js';
import expect from 'expect';
import nacl from 'tweetnacl';
import { Contract, publicKeyToHex } from '../../../src';
import { loadContract } from '../utils';

describe('Signature Check', () => {
    let contract: Contract;
    let storage: Keypair;

    before(async function () {
        this.timeout(150000);
        ({ contract, storage } = await loadContract(__dirname));
    });

    it('check valid signature', async function () {
        const message = Buffer.from('Foobar');
        const signature = nacl.sign.detached(message, storage.secretKey);

        const { result } = await contract.functions.verify(publicKeyToHex(storage.publicKey), message, signature, {
            ed25519sigs: [{ publicKey: storage.publicKey, message, signature }],
        });

        expect(result).toEqual(true);
    });
});
