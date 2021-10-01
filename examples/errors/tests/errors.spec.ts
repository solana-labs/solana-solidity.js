import expect from 'expect';
import { Contract } from '../../../src';
import { loadContract } from '../../utils';

describe('Errors', () => {
  let contract: Contract;

  before(async function () {
    this.timeout(150000);
    ({ contract } = await loadContract(__dirname, [false]));
  });

  it('catches reverts', async function () {
    let res = await contract.functions.doRevert(false);
    expect(res.toString()).toBe('3124445');

    try {
      res = await contract.functions.doRevert(true);
    } catch (e) {
      expect(e.message).toBe('Do the revert thing');
      expect(e.computeUnitsUsed).toBe(1046);
      expect(e.logs.length).toBeGreaterThan(1);
      return;
    }

    throw new Error('does not throw');
  });

  it('catches requires', async function () {
    let res = await contract.functions.doRequire(false);
    expect(res.toString()).toBe('3124445');

    try {
      res = await contract.functions.doRequire(true);
    } catch (e) {
      expect(e.message).toBe('Do the require thing');
      expect(e.computeUnitsUsed).toBe(775);
      expect(e.logs.length).toBeGreaterThan(1);
      return;
    }

    throw new Error('does not throw');
  });

  it('catches asserts', async function () {
    let res = await contract.functions.doAssert(false);
    expect(res.toString()).toBe('3124445');

    try {
      res = await contract.functions.doAssert(true);
    } catch (e) {
      expect(e.message).toBe('return data or log not set');
      expect(e.computeUnitsUsed).toBe(580);
      expect(e.logs.length).toBeGreaterThan(1);
      return;
    }

    throw new Error('does not throw');
  });

  it('catches constructor errors', async function () {
    this.timeout(150000);
    try {
      await loadContract(__dirname, [true]);
    } catch (e) {
      expect(e.message).toBe('Do the revert thing');
      expect(e.computeUnitsUsed).toBe(824);
      expect(e.logs.length).toBeGreaterThan(1);
      return;
    }

    throw new Error('does not throw');
  });
});
