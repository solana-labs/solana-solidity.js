import expect from 'expect';
import { Contract } from '../../../src';
import { loadContract } from '../utils';

describe('Native Solana', () => {
    let contract: Contract;

    before(async function () {
        this.timeout(150000);
        ({ contract } = await loadContract(__dirname));
    });

    it('can be transfered', async function () {
        // @FIXME: this code isn't testing anything useful
        const depositAmount = 10;

        const solBalance = await contract.connection.getBalance(contract.program);
        expect(solBalance).toBeGreaterThan(depositAmount);

        // const withdrawAmount = 5;
        // {result: bankBalance} = await contract.functions.deposit({
        //   value: depositAmount,
        // });
        // solBalance = await program.connection.getBalance(
        //   program.programAccount.publicKey
        // );
        // expect(bankBalance.toString()).toBeCloseTo(depositAmount);
        // expect(solBalance.sub(bankBalance).toString()).toBeCloseTo(bankBalance);

        // ({result: bankBalance} = await contract.functions.withdraw(withdrawAmount));
        // solBalance = await program.connection.getBalance(
        //   program.programAccount.publicKey
        // );
        // expect(bankBalance.toString()).toBeCloseTo(withdrawAmount);
        // expect(solBalance.sub(bankBalance).toString()).toBeCloseTo(bankBalance);
    });
});
