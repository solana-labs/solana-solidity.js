import { Signer } from '@solana/web3.js';
import expect from 'expect';
import { Contract, createProgramAddress, ProgramDerivedAddress } from '../../../src';
import { loadContract } from '../utils';

describe('ChildContract', () => {
    let contract: Contract;
    let storage: Signer;

    let childPDA: ProgramDerivedAddress;

    before(async function () {
        this.timeout(150000);
        ({ contract, storage } = await loadContract(__dirname, [], 'Creator'));
    });

    it('Creates child contract', async function () {
        childPDA = await createProgramAddress(contract.program);

        const { logs } = await contract.functions.createChild({
            accounts: [contract.program],
            programDerivedAddresses: [childPDA],
            signers: [storage],
        });

        expect(logs.toString()).toContain('initializing child');

        const info = await contract.connection.getAccountInfo(childPDA.address);
        console.log('info: ' + info);
    });

    xit('Reads child contract', async function () {
        const {
            logs,
            result: [value],
        } = await contract.functions.readChild({
            accounts: [childPDA.address],
            writableAccounts: [contract.program],
        });

        expect(logs.toString()).toContain('reading child');
        expect(value.toString()).toEqual('0');
    });

    xit('Updates child contract', async function () {
        const { logs: logs1 } = await contract.functions.updateChild(2, {
            accounts: [childPDA.address],
            writableAccounts: [contract.program],
            programDerivedAddresses: [childPDA],
            signers: [storage],
        });
        expect(logs1.toString()).toContain('updating child');

        const {
            logs: logs2,
            result: [value],
        } = await contract.functions.readChild({
            accounts: [childPDA.address],
            writableAccounts: [contract.program],
        });

        expect(logs2.toString()).toContain('reading child');
        expect(value.toString()).toEqual('2');
    });
});
