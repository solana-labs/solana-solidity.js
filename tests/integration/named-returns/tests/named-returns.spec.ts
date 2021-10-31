import expect from 'expect';
import { Contract } from '../../../../src';
import { loadContract } from '../../utils';

describe('Named Returns', () => {
  let contract: Contract;

  before(async function () {
    this.timeout(150000);
    ({ contract } = await loadContract(__dirname));
  });

  it('work', async function () {
    const {
      result: { a, b },
    } = await contract.functions.noop(1, 2);
    expect(a.toString()).toEqual('1');
    expect(b.toString()).toEqual('2');
  });
});
