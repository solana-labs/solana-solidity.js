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
  path.join(__dirname, '../build/Calc.abi'),
  'utf-8'
);

describe('Calc', () => {
  let program: Program;
  let calc: Contract;
  let wallet: string;

  before(async function () {
    this.timeout(150000);

    let connection = getConnection();
    let payerAccount = await newAccountWithLamports(connection);
    program = await Program.deploy(connection, payerAccount, PROGRAM_SO);
    wallet = pubKeyToHex(program.payerAccount.publicKey);
  });

  beforeEach(async function () {});

  it('calc', async function () {
    this.timeout(50000);

    calc = await Contract.deploy(
      program,
      'Calc',
      CONTRACT_ABI,
      [],
      [],
      8192 * 8
    );

    let res = await calc.simulate.add(1, 2);
    expect(res[0].toString()).toBe('3');

    try {
      await calc.simulate.div(1, 0);
    } catch (e) {
      expect(e.message).toBe('denominator should not be zero');
    }
  });
});
