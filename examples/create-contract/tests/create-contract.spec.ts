import expect from 'expect';
import { Contract, Program, createProgramAddress } from '../../../src';
import { loadContract } from '../../utils';

describe('CreateContract', () => {
  let program: Program;
  let contract: Contract;

  before(async function () {
    this.timeout(150000);
    ({ contract, program } = await loadContract(__dirname, [], 'Creator'));
  });

  it('Create Child', async function () {
    const { address, seed: childSeed } = (await createProgramAddress(
      program.programAccount.publicKey,
      Buffer.from('child seed')
    ))!;

    const { logs } = await contract.functions.createChild({
      accounts: [program.programAccount.publicKey],
      writeableAccounts: [address],
      seeds: [childSeed],
    });

    expect(logs.toString()).toContain('Hello there');
  });
});
