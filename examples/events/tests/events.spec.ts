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
  path.join(__dirname, '../build/Events.abi'),
  'utf-8'
);

describe('Events', () => {
  let program: Program;
  let events: Contract;
  let wallet: string;

  before(async function () {
    this.timeout(150000);

    let connection = getConnection();
    let payerAccount = await newAccountWithLamports(connection);
    program = await Program.deploy(connection, payerAccount, PROGRAM_SO);
    wallet = pubKeyToHex(program.payerAccount.publicKey);
  });

  beforeEach(async function () {});

  it('get triggered', async function () {
    this.timeout(50000);

    events = await Contract.deploy(
      program,
      'Events',
      CONTRACT_ABI,
      [],
      [],
      8192 * 8
    );

    await new Promise((resolve) => {
      let listenId = events.on('First', async (args) => {
        expect(args[0].toString()).toEqual('102');
        expect(args[1]).toEqual(true);
        expect(args[2]).toEqual('foobar');

        await events.off(listenId);

        resolve(true);

        events.functions.second();
      });
      events.functions.first();
    });

    await new Promise((resolve) => {
      let listenId = events.on('Second', async (args) => {
        expect(args[0].toString()).toEqual('500332');
        expect(args[1]).toEqual('0x41424344');
        expect(args[2]).toEqual('0xcafe0123');

        await events.off(listenId);

        resolve(true);
      });
      events.functions.second();
    });
  });
});
