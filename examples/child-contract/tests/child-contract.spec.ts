import { Keypair, PublicKey, Signer } from '@solana/web3.js';
import { randomBytes } from 'crypto';
import expect from 'expect';
import { Contract, ProgramDerivedAddress } from '../../../src';
import { loadContract } from '../../utils';

describe('ChildContract', () => {
    let contract: Contract;
    let storage: Signer;

    let childSeedAndAccount: ProgramDerivedAddress | null = null;
    let childStorageAccount: PublicKey | null = null;

    before(async function () {
        this.timeout(150000);
        ({ contract, storage } = await loadContract(__dirname, [], 'Creator'));
    });

    it('Creates child contract', async function () {
        const seed = randomBytes(7);
        const [account] = await PublicKey.findProgramAddress([seed], contract.program);
        childSeedAndAccount = { account, seed };

        const childStorage = Keypair.generate();
        await contract.createStorage(childStorage, 1024);
        childStorageAccount = childStorage.publicKey;

        const { logs } = await contract.functions.createChild({
            accounts: [childStorageAccount],
            writableAccounts: [contract.program],
            programDerivedAddresses: [childSeedAndAccount],
            signers: [storage],
        });

        expect(logs.toString()).toContain('initializing child');
    });

    xit('Reads child contract', async function () {
        const {
            logs,
            result: [value],
        } = await contract.functions.readChild({
            accounts: [childStorageAccount],
            writableAccounts: [contract.program],
        });

        expect(logs.toString()).toContain('reading child');
        expect(value.toString()).toEqual('0');
    });

    xit('Updates child contract', async function () {
        const { logs: logs1 } = await contract.functions.updateChild(2, {
            accounts: [childStorageAccount],
            writableAccounts: [contract.program],
            programDerivedAddresses: [childSeedAndAccount],
            signers: [storage],
        });
        expect(logs1.toString()).toContain('updating child');

        const {
            logs: logs2,
            result: [value],
        } = await contract.functions.readChild({
            accounts: [childStorageAccount],
            writableAccounts: [contract.program],
        });

        expect(logs2.toString()).toContain('reading child');
        expect(value.toString()).toEqual('2');
    });
});
