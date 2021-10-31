import expect from 'expect';
import { Contract, TransactionError } from '../../../../src';
import { loadContract } from '../../utils';

describe('Errors', () => {
  let contract: Contract;

  before(async function () {
    this.timeout(150000);
    ({ contract } = await loadContract(__dirname, [false]));
  });

  it('catches reverts', async function () {
    const { result } = await contract.functions.doRevert(false);
    expect(result.toString()).toBe('3124445');

    try {
      await contract.functions.doRevert(true);
    } catch (_e) {
      const e = _e as TransactionError;
      expect(e.message).toBe('Do the revert thing');
      expect(e.computeUnitsUsed).toBe(1047);
      expect(e.logs.length).toBeGreaterThan(1);
      return;
    }

    throw new Error('does not throw');
  });

  it('catches requires', async function () {
    const { result } = await contract.functions.doRequire(false);
    expect(result.toString()).toBe('3124445');

    try {
      await contract.functions.doRequire(true);
    } catch (_e) {
      const e = _e as TransactionError;
      expect(e.message).toBe('Do the require thing');
      expect(e.computeUnitsUsed).toBe(776);
      expect(e.logs.length).toBeGreaterThan(1);
      return;
    }

    throw new Error('does not throw');
  });

  it('catches asserts', async function () {
    const { result } = await contract.functions.doAssert(false);
    expect(result.toString()).toBe('3124445');

    try {
      await contract.functions.doAssert(true);
    } catch (_e) {
      const e = _e as TransactionError;
      expect(e.message).toBe('custom program error: 0x0');
      expect(e.computeUnitsUsed).toBe(582);
      expect(e.logs.length).toBeGreaterThan(1);
      return;
    }

    throw new Error('does not throw');
  });

  it('catches constructor errors', async function () {
    this.timeout(150000);
    try {
      await loadContract(__dirname, [true]);
    } catch (_e) {
      const e = _e as TransactionError;
      expect(e.message).toBe('Do the revert thing');
      expect(e.computeUnitsUsed).toBe(824);
      expect(e.logs.length).toBeGreaterThan(1);
      return;
    }

    throw new Error('does not throw');
  });

  it('catches divide by zero', async function () {
    this.timeout(150000);

    const { result } = await contract.functions.divide(15, 5);
    expect(result.toString()).toBe('3');

    try {
      await contract.functions.divide(15, 0);
    } catch (_e) {
      const e = _e as TransactionError;
      expect(e.message).toBe('divide by zero at instruction 592');
      expect(e.computeUnitsUsed).toBe(476);
      expect(e.logs.length).toBeGreaterThan(1);
      return;
    }

    throw new Error('does not throw');
  });
});

describe('Errors', () => {
  it('deploy with not enough space', async function () {
    this.timeout(150000);

    try {
      await loadContract(__dirname, [false], 'Errors', 10);
    } catch (_e) {
      const e = _e as TransactionError;
      expect(e.message).toBe('account data too small for instruction');
      expect(e.computeUnitsUsed).toBe(232);
      expect(e.logs.length).toBeGreaterThan(1);
      return;
    }

    throw new Error('does not throw');
  });
});
