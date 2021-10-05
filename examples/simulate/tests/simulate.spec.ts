import expect from 'expect';
import { Contract, TransactionError } from '../../../src';
import { loadContract } from '../../utils';

describe('Simulate', () => {
  let contract: Contract;

  before(async function () {
    this.timeout(150000);
    ({ contract } = await loadContract(__dirname));
  });

  it('calc', async function () {
    const { result, logs, computeUnitsUsed } = await contract.functions.add(
      1,
      2,
      {
        simulate: true,
      }
    );
    expect(result.toString()).toBe('3');
    expect(logs.length).toBeGreaterThan(1);
    expect(computeUnitsUsed).toBe(1548);

    try {
      await contract.functions.div(1, 0, {
        simulate: true,
      });
    } catch (_e) {
      const e = _e as TransactionError;
      expect(e.message).toBe('denominator should not be zero');
    }
  });
});
