import expect from 'expect';
import { Contract, Program } from '../../../src';
import { loadContract } from '../../utils';

describe('Native Solana', () => {
  let contract: Contract;
  let program: Program;

  before(async function () {
    this.timeout(150000);
    ({ contract, program } = await loadContract(__dirname));
  });

  it('can be transfered', async function () {
    let bankBalance, solBalance;

    const depositAmount = 10;
    const withdrawAmount = 5;

    solBalance = await program.connection.getBalance(
      program.programAccount.publicKey
    );
    expect(solBalance).toBeGreaterThan(depositAmount);

    // ({result: bankBalance} = await contract.functions.deposit({
    //   value: depositAmount,
    // }));
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
