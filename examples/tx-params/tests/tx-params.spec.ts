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

const PROGRAM_SO = fs.readFileSync(path.join(__dirname, '../build/bundle.so'));
const CONTRACT_ABI = fs.readFileSync(
  path.join(__dirname, '../build/Array.abi'),
  'utf-8'
);

describe('Array', () => {
  let program: Program;
  let contract: Contract;
  let wallet: string;

  before(async function () {
    this.timeout(150000);

    let connection = getConnection();
    let payerAccount = await newAccountWithLamports(connection);
    program = await Program.deploy(connection, payerAccount, PROGRAM_SO);
    wallet = pubKeyToHex(program.payerAccount.publicKey);

    contract = await Contract.deploy(
      program,
      'Array',
      CONTRACT_ABI,
      [],
      [],
      8192 * 8
    );
  });

  beforeEach(async function () {});

  it('works without tx params', async function () {
    let res = await contract.functions.sum([1, 2, 3]);
    expect(res.toString()).toBe('6');
  });

  it('works with tx params', async function () {
    let res = await contract.functions.sum([1, 2, 3], {
      signers: [],
    });
    expect(res.toString()).toBe('6');
  });
});
