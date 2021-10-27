import { Keypair, PublicKey } from '@solana/web3.js';
import expect from 'expect';
import { Contract, Program, ProgramDerivedAddress } from '../../../src';
import { loadContract } from '../../utils';

describe('ChildContract', () => {
  let program: Program;
  let contract: Contract;
  let contractStorageKeyPair: Keypair;

  let childSeedAndAccount: ProgramDerivedAddress | null = null;
  let childStorageAccount: PublicKey | null = null;

  before(async function () {
    this.timeout(150000);
    ({ contract, program, contractStorageKeyPair } = await loadContract(
      __dirname,
      [],
      'Creator'
    ));
  });

  it('Creates child contract', async function () {
    [childSeedAndAccount, { publicKey: childStorageAccount }] =
      await Promise.all([
        program.createProgramAddress(),
        program.createStorageAccount(Keypair.generate(), 1024),
      ]);

    const { logs } = await contract.functions.createChild({
      accounts: [childStorageAccount],
      writableAccounts: [contract.getProgramKey()],
      programDerivedAddresses: [childSeedAndAccount!],
      signers: [contractStorageKeyPair],
    });

    expect(logs.toString()).toContain('initializing child');
  });

  xit('Reads child contract', async function () {
    const {
      logs,
      result: [value],
    } = await contract.functions.readChild({
      accounts: [childStorageAccount],
      writableAccounts: [contract.getProgramKey()],
    });

    expect(logs.toString()).toContain('reading child');
    expect(value.toString()).toEqual('0');
  });

  xit('Updates child contract', async function () {
    const { logs: logs1 } = await contract.functions.updateChild(2, {
      accounts: [childStorageAccount],
      writableAccounts: [contract.getProgramKey()],
      programDerivedAddresses: [childSeedAndAccount!],
      signers: [contractStorageKeyPair],
    });
    expect(logs1.toString()).toContain('updating child');

    const {
      logs: logs2,
      result: [value],
    } = await contract.functions.readChild({
      accounts: [childStorageAccount],
      writableAccounts: [contract.getProgramKey()],
    });

    expect(logs2.toString()).toContain('reading child');
    expect(value.toString()).toEqual('2');
  });
});
