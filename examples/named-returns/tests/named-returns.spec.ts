import expect from 'expect';
import { Contract } from '../../../src';
import { loadContract } from '../../utils';

describe('Test', () => {
  let contract: Contract;

  before(async function () {
    this.timeout(150000);
    ({ contract } = await loadContract(__dirname));
  });

  it('multiple named returns work', async function () {
    const { a, b } = await contract.functions.noop(1, 2);
    expect(a.toString()).toEqual('1');
    expect(b.toString()).toEqual('2');
  });
});
