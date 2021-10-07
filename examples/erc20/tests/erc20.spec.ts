import expect from 'expect';
import { ethers } from 'ethers';
import { Keypair } from '@solana/web3.js';

import { Contract, Program, pubKeyToHex } from '../../../src';
import { loadContract } from '../../utils';

const NAME = 'Solana';
const SYMBOL = 'SOL';
const TOTAL_SUPPLY = ethers.utils.parseEther('10000');

describe('ERC20', () => {
  let program: Program;
  let token: Contract;
  let payerETHAddress: string;
  let contractAbi: string;

  it('deploys new contract', async function () {
    this.timeout(150000);
    ({
      contract: token,
      payerETHAddress,
      contractAbi,
      program,
    } = await loadContract(__dirname, [NAME, SYMBOL, TOTAL_SUPPLY]));

    const { result: name } = await token.functions.name();
    expect(name).toEqual('Solana');

    const { result: symbol } = await token.functions.symbol();
    expect(symbol).toEqual('SOL');

    const { result: decimals } = await token.functions.decimals();
    expect(decimals).toEqual(18);

    const { result: supply } = await token.functions.totalSupply();
    expect(supply).toEqual(TOTAL_SUPPLY);

    const { result: balance } = await token.functions.balanceOf(
      payerETHAddress
    );
    expect(balance).toEqual(TOTAL_SUPPLY);
  });

  it('loads existing contract', async function () {
    token = await program.getContract(contractAbi, token.getStorageKeyPair());

    const { result: name } = await token.functions.name();
    expect(name).toEqual('Solana');
  });

  it('mutates contract state', async function () {
    const otherAccount = pubKeyToHex(Keypair.generate().publicKey);
    const transferAmount = ethers.utils.parseEther('0.9');

    await token.functions.transfer(otherAccount, transferAmount);

    const { result: otherAccountBalance } = await token.functions.balanceOf(
      otherAccount
    );
    expect(otherAccountBalance).toEqual(transferAmount);

    const { result: payerBalance } = await token.functions.balanceOf(
      payerETHAddress
    );
    expect(payerBalance).toEqual(TOTAL_SUPPLY.sub(transferAmount));
  });

  it('emits events', async function () {
    const spenderAccount = pubKeyToHex(Keypair.generate().publicKey);
    const spendAmount = ethers.utils.parseEther('0.9');

    const event: ethers.utils.LogDescription = await new Promise((resolve) => {
      let listenId = token.addEventListener(async (event) => {
        await token.removeEventListener(listenId);
        resolve(event);
      });
      token.functions.approve(spenderAccount, spendAmount);
    });

    expect(event.name).toEqual('Approval');
    const [owner, spender, value] = event.args;
    expect(owner).toEqual(payerETHAddress);
    expect(spender).toEqual(spenderAccount);
    expect(value.eq(spendAmount)).toBeTruthy;
  });
});
