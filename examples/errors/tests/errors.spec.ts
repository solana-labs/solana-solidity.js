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
  path.join(__dirname, '../build/Errors.abi'),
  'utf-8'
);

describe('Errors', () => {
  let program: Program;
  let errors: Contract;
  let wallet: string;

  before(async function () {
    this.timeout(150000);

    let connection = getConnection();
    let payerAccount = await newAccountWithLamports(connection);
    program = await Program.deploy(connection, payerAccount, PROGRAM_SO);
    wallet = pubKeyToHex(program.payerAccount.publicKey);
  });

  beforeEach(async function () {});

  it('errors', async function () {
    this.timeout(50000);

    errors = await Contract.deploy(
      program,
      'Errors',
      CONTRACT_ABI,
      [],
      [],
      8192 * 8
    );

    // call the constructor
    let res = await errors.functions.doRevert(false);
    expect(res[0].toString()).toBe('3124445');

    try {
      res = await errors.functions.doRevert(true);
    } catch (e) {
      expect(e.message).toBe('Do the revert thing');
      return;
    }

    throw new Error('does not throw');
  });
});
