import expect from 'expect';
import { Contract } from '../../../src';
import { loadContract } from '../../utils';

describe('Events', () => {
  let contract: Contract;

  before(async function () {
    this.timeout(150000);
    ({ contract } = await loadContract(__dirname));
  });

  it('get triggered', async function () {
    await new Promise((resolve) => {
      let listenId = contract.addEventListener('First', async (...args) => {
        expect(args[0].toString()).toEqual('102');
        expect(args[1]).toEqual(true);
        expect(args[2]).toEqual('foobar');

        await contract.removeEventListener(listenId);
        resolve(true);
      });
      contract.functions.first();
    });

    await new Promise((resolve) => {
      let listenId = contract.addEventListener('Second', async (...args) => {
        expect(args[0].toString()).toEqual('500332');
        expect(args[1]).toEqual('0x41424344');
        expect(args[2]).toEqual('0xcafe0123');

        await contract.removeEventListener(listenId);
        resolve(true);
      });
      contract.functions.second();
    });
  });
});
