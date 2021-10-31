import expect from 'expect';
import { LogDescription } from '@ethersproject/abi';
import { Keypair } from '@solana/web3.js';

import { Contract, Program, pubKeyToHex } from '../../../../src';
import { loadContract } from '../../utils';

const NAME = 'Solana';
const SYMBOL = 'SOL';
const TOTAL_SUPPLY = 10000;

describe('ERC20', () => {
  let program: Program;
  let token: Contract;
  let payerETHAddress: string;
  let contractAbi: string;
  let tokenStorageKeyPair: Keypair;

  it('deploys new contract', async function () {
    this.timeout(150000);
    ({
      contract: token,
      payerETHAddress,
      contractAbi,
      program,
      contractStorageKeyPair: tokenStorageKeyPair,
    } = await loadContract(__dirname, [NAME, SYMBOL, TOTAL_SUPPLY]));

    const { result: name } = await token.functions.name();
    expect(name).toEqual('Solana');

    const { result: symbol } = await token.functions.symbol();
    expect(symbol).toEqual('SOL');

    const { result: decimals } = await token.functions.decimals();
    expect(decimals).toEqual(18);

    const { result: supply } = await token.functions.totalSupply();
    expect(supply.toString()).toEqual(TOTAL_SUPPLY.toString());

    const { result: balance } = await token.functions.balanceOf(
      payerETHAddress
    );
    expect(balance.toString()).toEqual(TOTAL_SUPPLY.toString());
  });

  it('loads existing contract', async function () {
    token = await program.getContract(
      contractAbi,
      tokenStorageKeyPair.publicKey
    );

    const { result: name } = await token.functions.name();
    expect(name).toEqual('Solana');
  });

  it('mutates contract state', async function () {
    const otherAccount = pubKeyToHex(Keypair.generate().publicKey);
    const transferAmount = 9;

    await token.functions.transfer(otherAccount, transferAmount);

    const { result: otherAccountBalance } = await token.functions.balanceOf(
      otherAccount
    );
    expect(otherAccountBalance.toString()).toEqual(transferAmount.toString());

    const { result: payerBalance } = await token.functions.balanceOf(
      payerETHAddress
    );
    expect(payerBalance.toString()).toEqual(
      (TOTAL_SUPPLY - transferAmount).toString()
    );
  });

  it('emits events', async function () {
    const spenderAccount = pubKeyToHex(Keypair.generate().publicKey);
    const spendAmount = 9;

    const event: LogDescription = await new Promise((resolve) => {
      let listenId = token.addEventListener(async (event) => {
        await token.removeEventListener(listenId);
        resolve(event);
      });
      token.functions.approve(spenderAccount, spendAmount);
    });

    expect(event.name).toEqual('Approval');
    const [owner, spender, value] = event.args;
    expect(owner).toEqual(payerETHAddress);
    expect(spender.toString()).toEqual(spenderAccount.toString());
    expect(value.eq(spendAmount)).toBeTruthy;
  });
});
