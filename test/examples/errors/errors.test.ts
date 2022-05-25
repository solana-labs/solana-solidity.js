import expect from 'expect';
import { Contract, TransactionError } from '../../../src';
import { loadContract } from '../utils';

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
        } catch (error) {
            if (!(error instanceof TransactionError)) throw error;
            expect(error.message).toBe('Do the revert thing');
            expect(error.computeUnitsUsed).toBeGreaterThan(1000);
            expect(error.computeUnitsUsed).toBeLessThan(1100);
            expect(error.logs.length).toBeGreaterThan(1);
            return;
        }

        throw new Error('does not throw');
    });

    it('catches requires', async function () {
        const { result } = await contract.functions.doRequire(false);
        expect(result.toString()).toBe('3124445');

        try {
            await contract.functions.doRequire(true);
        } catch (error) {
            if (!(error instanceof TransactionError)) throw error;
            expect(error.message).toBe('Do the require thing');
            expect(error.computeUnitsUsed).toBeGreaterThan(700);
            expect(error.computeUnitsUsed).toBeLessThan(900);
            expect(error.logs.length).toBeGreaterThan(1);
            return;
        }

        throw new Error('does not throw');
    });

    it('catches asserts', async function () {
        const { result } = await contract.functions.doAssert(false);
        expect(result.toString()).toBe('3124445');

        try {
            await contract.functions.doAssert(true);
        } catch (error) {
            if (!(error instanceof TransactionError)) throw error;
            expect(error.message).toBe('custom program error: 0x0');
            expect(error.computeUnitsUsed).toBeGreaterThan(500);
            expect(error.computeUnitsUsed).toBeLessThan(600);
            expect(error.logs.length).toBeGreaterThan(1);
            return;
        }

        throw new Error('does not throw');
    });

    it('catches constructor errors', async function () {
        this.timeout(150000);
        try {
            await loadContract(__dirname, [true]);
        } catch (error) {
            if (!(error instanceof TransactionError)) throw error;
            expect(error.message).toBe('Do the revert thing');
            expect(error.computeUnitsUsed).toBeGreaterThan(1000);
            expect(error.computeUnitsUsed).toBeLessThan(1100);
            expect(error.logs.length).toBeGreaterThan(1);
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
        } catch (error) {
            if (!(error instanceof TransactionError)) throw error;
            expect(error.message).toMatch(/^divide by zero at instruction/);
            expect(error.computeUnitsUsed).toBeGreaterThan(400);
            expect(error.computeUnitsUsed).toBeLessThan(500);
            expect(error.logs.length).toBeGreaterThan(1);
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
        } catch (error) {
            if (!(error instanceof TransactionError)) throw error;
            expect(error.message).toBe('account data too small for instruction');
            expect(error.computeUnitsUsed).toBeGreaterThan(400);
            expect(error.computeUnitsUsed).toBeLessThan(500);
            expect(error.logs.length).toBeGreaterThan(1);
            return;
        }

        throw new Error('does not throw');
    });
});
