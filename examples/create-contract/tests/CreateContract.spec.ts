import expect from 'expect';
import { Contract, TransactionError } from '../../../src';
import { loadContract } from '../../utils';

describe('CreateContract', () => {
  let contract: Contract;

  before(async function () {
    this.timeout(150000);
    ({ contract } = await loadContract(__dirname, [false]));
  });

  it('Create Child', async function () {
    const child_seed = createProgramAddress(program.programAccount);

    const { logs, result } = await contract.functions.create_child({ accounts: [program.programAccount], seeds: [child_seed] });

    expect(logs.toContain("Hello there"));
  });
});
