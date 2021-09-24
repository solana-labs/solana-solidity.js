import { ethers } from 'ethers';
import expect from 'expect';
import path from 'path';
import fs from 'fs';
import {
  Contract,
  Program,
  newAccountWithLamports,
  getConnection,
  pubKeyToHex,
} from '../../../src';
import { Keypair } from '@solana/web3.js';

const NAME = 'Solana';
const SYMBOL = 'SOL';
const TOTAL_SUPPLY = ethers.utils.parseEther('10000');

const PROGRAM_SO = fs.readFileSync(path.join(__dirname, '../build/bundle.so'));
const CONTRACT_ABI = fs.readFileSync(
  path.join(__dirname, '../build/ERC20.abi'),
  'utf-8'
);

describe('ERC20', () => {
  let program: Program;
  let token: Contract;
  let wallet: string;

  before(async function () {
    this.timeout(150000);

    let connection = getConnection();
    let payerAccount = await newAccountWithLamports(connection);
    program = await Program.deploy(connection, payerAccount, PROGRAM_SO);
    wallet = pubKeyToHex(program.payerAccount.publicKey);
  });

  beforeEach(async function () {});

  it('deploys new contracts', async function () {
    this.timeout(150000);

    token = await Contract.deploy(
      program,
      'ERC20',
      CONTRACT_ABI,
      [NAME, SYMBOL, TOTAL_SUPPLY],
      [],
      8192 * 8
    );

    let res = await token.functions.name();
    expect(res[0].toString()).toEqual('Solana');

    res = await token.functions.symbol();
    expect(res[0].toString()).toEqual('SOL');

    res = await token.functions.decimals();
    expect(res[0]).toEqual(18);

    res = await token.functions.totalSupply();
    expect(res[0]).toEqual(TOTAL_SUPPLY);

    res = await token.functions.balanceOf(wallet);
    expect(res[0]).toEqual(TOTAL_SUPPLY);
  });

  it('loads existing contracts', async function () {
    token = await Contract.get(
      program,
      CONTRACT_ABI,
      token.getStorageKeyPair()
    );

    let res = await token.functions.name();
    expect(res[0].toString()).toEqual('Solana');
  });

  it('mutates contract state', async function () {
    const otherAccount = pubKeyToHex(Keypair.generate().publicKey);
    const transferAmount = ethers.utils.parseEther('0.9');

    await token.functions.transfer(otherAccount, transferAmount);

    let res = await token.functions.balanceOf(otherAccount);
    expect(res[0]).toEqual(transferAmount);

    res = await token.functions.balanceOf(wallet);
    expect(res[0]).toEqual(TOTAL_SUPPLY.sub(transferAmount));
  });

  it('emits events', async function () {
    const spenderAccount = pubKeyToHex(Keypair.generate().publicKey);
    const spendAmount = ethers.utils.parseEther('0.9');

    token = await Contract.deploy(
      program,
      'ERC20',
      CONTRACT_ABI,
      [NAME, SYMBOL, TOTAL_SUPPLY],
      [],
      8192 * 8
    );

    await new Promise((resolve) => {
      let listenId = token.on(
        'Approval',
        async (owner: string, spender: string, value: ethers.BigNumber) => {
          expect(owner).toEqual(wallet);
          expect(spender).toEqual(spenderAccount);
          expect(value.eq(spendAmount)).toBeTruthy;
          await token.off(listenId);
          resolve(true);
        }
      );

      token.functions.approve(spenderAccount, spendAmount);
    });
  });
});
