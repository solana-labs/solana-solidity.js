import expect from 'expect';
import { Contract, TxError } from '../../../src';
import { loadContract } from '../../utils';

describe('Simulate', () => {
  let contract: Contract;

  before(async function () {
    this.timeout(150000);
    ({ contract } = await loadContract(__dirname));
  });

  it('calc', async function () {
    let res = await contract.functions.add(1, 2, {
      simulate: true,
    });
    expect(res.toString()).toBe('3');

    try {
      await contract.functions.div(1, 0, {
        simulate: true,
      });
    } catch (_e) {
      const e = _e as TxError;
      expect(e.message).toBe('denominator should not be zero');
    }
  });
});
