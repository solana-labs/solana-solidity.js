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

    errors = await Contract.deploy(
      program,
      'Errors',
      CONTRACT_ABI,
      [],
      [],
      8192 * 8
    );
  });

  beforeEach(async function () {});

  it('catches reverts', async function () {
    let res = await errors.functions.doRevert(false);
    expect(res.toString()).toBe('3124445');

    try {
      res = await errors.functions.doRevert(true);
    } catch (e) {
      expect(e.message).toBe('Do the revert thing');
      expect(e.computeUnitsUsed).toBe(1023);
      expect(e.logs.length).toBeGreaterThan(1);
      return;
    }

    throw new Error('does not throw');
  });

  it('catches requires', async function () {
    let res = await errors.functions.doRequire(false);
    expect(res.toString()).toBe('3124445');

    try {
      res = await errors.functions.doRequire(true);
    } catch (e) {
      expect(e.message).toBe('Do the require thing');
      expect(e.computeUnitsUsed).toBe(753);
      expect(e.logs.length).toBeGreaterThan(1);
      return;
    }

    throw new Error('does not throw');
  });

  it('catches asserts', async function () {
    let res = await errors.functions.doAssert(false);
    expect(res.toString()).toBe('3124445');

    try {
      res = await errors.functions.doAssert(true);
    } catch (e) {
      expect(e.message).toBe('return data or log not set');
      expect(e.computeUnitsUsed).toBe(558);
      expect(e.logs.length).toBeGreaterThan(1);
      return;
    }

    throw new Error('does not throw');
  });
});
