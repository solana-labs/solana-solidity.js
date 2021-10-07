import { ethers } from 'ethers';
import expect from 'expect';
import { Contract } from '../../../src';
import { loadContract } from '../../utils';

describe('Events', () => {
  let contract: Contract;

  it('get returned in contract deploy results', async function () {
    this.timeout(150000);

    const result = await loadContract(__dirname);
    contract = result.contract;
    const events = result.events;
    expect(events.length).toEqual(1);

    const [{ args }] = events;
    expect(args.length).toEqual(3);
    expect(args[0].toString()).toEqual('102');
    expect(args[1]).toEqual(true);
    expect(args[2]).toEqual('foobar');
  });

  it('can be subscribed', async function () {
    const args: ethers.utils.LogDescription[] = await new Promise(
      async (resolve) => {
        let listenId = contract.addEventListener('First', async (...args) => {
          await contract.removeEventListener(listenId);
          resolve(args);
        });
        await contract.functions.first();
      }
    );

    expect(args.length).toEqual(3);
    expect(args[0].toString()).toEqual('102');
    expect(args[1]).toEqual(true);
    expect(args[2]).toEqual('foobar');
  });

  it('get returned in contract call results', async function () {
    const { events } = await contract.functions.second();

    expect(events.length).toEqual(1);

    const [{ args }] = events;
    expect(args.length).toEqual(3);
    expect(args[0].toString()).toEqual('500332');
    expect(args[1]).toEqual('0x41424344');
    expect(args[2]).toEqual('0xcafe0123');
  });
});
