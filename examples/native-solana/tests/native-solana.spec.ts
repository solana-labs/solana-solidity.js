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
    let ethBalance, solBalance;

    const depositAmount = 10;
    const withdrawAmount = 5;

    solBalance = await program.connection.getBalance(
      program.programAccount.publicKey
    );
    expect(solBalance).toBeGreaterThan(depositAmount);

    // ethBalance = await contract.functions.deposit({
    //   value: depositAmount,
    // });
    // solBalance = await program.connection.getBalance(
    //   program.programAccount.publicKey
    // );
    // expect(ethBalance.toString()).toBeCloseTo(depositAmount);
    // expect(solBalance.sub(ethBalance).toString()).toBeCloseTo(ethBalance);

    // ethBalance = await contract.functions.withdraw(withdrawAmount);
    // solBalance = await program.connection.getBalance(
    //   program.programAccount.publicKey
    // );
    // expect(ethBalance.toString()).toBeCloseTo(withdrawAmount);
    // expect(solBalance.sub(ethBalance).toString()).toBeCloseTo(ethBalance);
  });
});
