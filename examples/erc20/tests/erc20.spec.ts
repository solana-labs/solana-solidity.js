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
  let wallet: string;
  let contractAbi: string;

  it('deploys new contracts', async function () {
    this.timeout(150000);
    ({
      contract: token,
      wallet,
      contractAbi,
      program,
    } = await loadContract(__dirname, [NAME, SYMBOL, TOTAL_SUPPLY]));

    let res = await token.functions.name();
    expect(res.toString()).toEqual('Solana');

    res = await token.functions.symbol();
    expect(res.toString()).toEqual('SOL');

    res = await token.functions.decimals();
    expect(res).toEqual(18);

    res = await token.functions.totalSupply();
    expect(res).toEqual(TOTAL_SUPPLY);

    res = await token.functions.balanceOf(wallet);
    expect(res).toEqual(TOTAL_SUPPLY);
  });

  it('loads existing contracts', async function () {
    token = await Contract.get(program, contractAbi, token.getStorageKeyPair());

    let res = await token.functions.name();
    expect(res.toString()).toEqual('Solana');
  });

  it('mutates contract state', async function () {
    const otherAccount = pubKeyToHex(Keypair.generate().publicKey);
    const transferAmount = ethers.utils.parseEther('0.9');

    await token.functions.transfer(otherAccount, transferAmount);

    let res = await token.functions.balanceOf(otherAccount);
    expect(res).toEqual(transferAmount);

    res = await token.functions.balanceOf(wallet);
    expect(res).toEqual(TOTAL_SUPPLY.sub(transferAmount));
  });

  it('emits events', async function () {
    const spenderAccount = pubKeyToHex(Keypair.generate().publicKey);
    const spendAmount = ethers.utils.parseEther('0.9');

    await new Promise((resolve) => {
      let listenId = token.addEventListener(
        'Approval',
        async (owner: string, spender: string, value: ethers.BigNumber) => {
          expect(owner).toEqual(wallet);
          expect(spender).toEqual(spenderAccount);
          expect(value.eq(spendAmount)).toBeTruthy;
          await token.removeEventListener(listenId);
          resolve(true);
        }
      );

      token.functions.approve(spenderAccount, spendAmount);
    });
  });
});
