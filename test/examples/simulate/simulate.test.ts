import expect from 'expect';
import { Contract } from '../../../src';
import { loadContract } from '../utils';

describe('Simulate', () => {
    let contract: Contract;

    before(async function () {
        this.timeout(150000);
        ({ contract } = await loadContract(__dirname));
    });

    it('calc', async function () {
        const { result, logs, computeUnitsUsed } = await contract.functions.add(1, 2, { simulate: true }); // @FIXME: how do we ensure this is testing simulation?
        expect(result.toString()).toBe('3');
        expect(logs.length).toBeGreaterThan(1);
        expect(computeUnitsUsed).toBeGreaterThan(1500);
        expect(computeUnitsUsed).toBeLessThan(1600);

        try {
            await contract.functions.div(1, 0, { simulate: true }); // @FIXME: how do we ensure this is testing simulation?
        } catch (error: any) {
            expect(error?.message).toBe('denominator should not be zero');
        }
    });
});
