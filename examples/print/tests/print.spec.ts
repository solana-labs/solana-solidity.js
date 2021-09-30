import expect from 'expect';
import { Contract, Program } from '../../../src';
import { loadContract } from '../../utils';

describe('Print', () => {
  let contract: Contract;
  let program: Program;

  before(async function () {
    this.timeout(150000);
    ({ contract, program } = await loadContract(__dirname));
  });

  it('logs', async function () {
    await new Promise((resolve) => {
      let listenId = program.addLogListener(async (msg) => {
        expect(msg.toString()).toEqual('Hello, World!');

        await program.removeLogListener(listenId);

        resolve(true);
      });
      contract.functions.greet();
    });
  });
});
