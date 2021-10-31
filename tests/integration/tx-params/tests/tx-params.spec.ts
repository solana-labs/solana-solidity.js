import expect from 'expect';
import { Contract } from '../../../../src';
import { loadContract } from '../../utils';

describe('TxParams', () => {
  let contract: Contract;

  before(async function () {
    this.timeout(150000);
    ({ contract } = await loadContract(__dirname));
  });

  it('works without tx params', async function () {
    const { result, logs, computeUnitsUsed } = await contract.functions.sum([
      1, 2, 3,
    ]);
    expect(result.toString()).toBe('6');
    expect(logs.length).toBeGreaterThan(1);
    expect(computeUnitsUsed).toBe(2612);
  });

  it('works with tx params', async function () {
    const { result, logs, computeUnitsUsed } = await contract.functions.sum(
      [1, 2, 3],
      {
        signers: [],
      }
    );
    expect(result.toString()).toBe('6');
    expect(logs.length).toBeGreaterThan(1);
    expect(computeUnitsUsed).toBe(2612);
  });
});
