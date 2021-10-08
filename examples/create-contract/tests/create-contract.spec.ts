import expect from 'expect';
import { Contract, Program } from '../../../src';
import { loadContract } from '../../utils';

describe('CreateContract', () => {
  let program: Program;
  let contract: Contract;

  before(async function () {
    this.timeout(150000);
    ({ contract, program } = await loadContract(__dirname, [], 'Creator'));
  });

  it('Creates child contract', async function () {
    const [childSeedAndAccount, { publicKey: childStorageAccount }] =
      await Promise.all([
        program.createProgramAddress(),
        program.createStorageAccount(1024),
      ]);

    const { seed: childSeed, account: childAccount } = childSeedAndAccount!;

    const { logs } = await contract.functions.createChild({
      accounts: [childStorageAccount],
      writableAccounts: [contract.getProgramKey()],
      seeds: [childSeed],
      signers: [contract.getStorageKeyPair()],
      programDerivedAddresses: [childAccount],
    });

    expect(logs.toString()).toContain('Hello there');
  });
});
