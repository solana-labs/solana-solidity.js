import expect from 'expect';
import { Contract } from '../../../src';
import { loadContract } from '../../utils';

describe('TxParams', () => {
  let contract: Contract;

  before(async function () {
    this.timeout(150000);
    ({ contract } = await loadContract(__dirname));
  });

  it('works without tx params', async function () {
    let res = await contract.functions.sum([1, 2, 3]);
    expect(res.toString()).toBe('6');
  });

  it('works with tx params', async function () {
    let res = await contract.functions.sum([1, 2, 3], {
      signers: [],
    });
    expect(res.toString()).toBe('6');
  });
});
