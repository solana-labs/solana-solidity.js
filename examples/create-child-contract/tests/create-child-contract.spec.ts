import { Keypair } from '@solana/web3.js';
import expect from 'expect';
import { Contract, Program } from '../../../src';
import { loadContract } from '../../utils';

describe('CreateContract', () => {
  let program: Program;
  let contract: Contract;
  let contractStorageKeyPair: Keypair;

  before(async function () {
    this.timeout(150000);
    ({ contract, program, contractStorageKeyPair } = await loadContract(
      __dirname,
      [],
      'Creator'
    ));
  });

  it('Creates child contract', async function () {
    const [childSeedAndAccount, { publicKey: childStorageAccount }] =
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

    expect(logs.toString()).toContain('Hello there');
  });
});
