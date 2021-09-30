import expect from 'expect';
import { Contract } from '../../../src';
import { loadContract } from '../../utils';

describe('Simulate', () => {
  let contract: Contract;

  before(async function () {
    this.timeout(150000);
    ({ contract } = await loadContract(__dirname));
  });

  it('calc', async function () {
    let res = await contract.simulate.add(1, 2);
    expect(res.toString()).toBe('3');

    try {
      await contract.simulate.div(1, 0);
    } catch (e) {
      expect(e.message).toBe('denominator should not be zero');
    }
  });
});
