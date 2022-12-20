import { LogDescription } from '@ethersproject/abi';
import { Keypair, PublicKey } from '@solana/web3.js';
import expect from 'expect';

import { Contract } from '../../../src';
import { loadContract } from '../utils';
import { decode } from 'bs58';

const NAME = 'Solana';
const SYMBOL = 'SOL';
const TOTAL_SUPPLY = 10000;

describe('ERC20', () => {
    let contract: Contract;
    let payerETHAddress: PublicKey;

    before(async function () {
        this.timeout(150000);
        ({ contract, payerETHAddress } = await loadContract(__dirname, 'ERC20', [NAME, SYMBOL, TOTAL_SUPPLY]));
    });

    it('deploys new contract', async function () {
        const name = await contract.name();
        expect(name).toEqual(NAME);

        const symbol = await contract.symbol();
        expect(symbol).toEqual(SYMBOL);

        const decimals = await contract.decimals();
        expect(decimals).toEqual(18);

        const supply = await contract.totalSupply();
        expect(supply.toString()).toEqual(TOTAL_SUPPLY.toString());

        const balance = await contract.balanceOf(payerETHAddress.toBytes());
        expect(balance.toString()).toEqual(TOTAL_SUPPLY.toString());
    });

    it('works with existing contract', async function () {
        contract = new Contract(contract.connection, contract.program, contract.storage, contract.abi, contract.payer);
        const name = await contract.name();
        expect(name).toEqual('Solana');
    });

    it('mutates contract state', async function () {
        const otherAccount = Keypair.generate().publicKey;
        const transferAmount = 9;

        const { signature } = await contract.functions.transfer(otherAccount.toBytes(), transferAmount);

        expect(decode(signature).length).toBe(64);

        const otherAccountBalance = await contract.balanceOf(otherAccount.toBytes());
        expect(otherAccountBalance.toString()).toEqual(transferAmount.toString());

        const payerBalance = await contract.balanceOf(payerETHAddress.toBytes());
        expect(payerBalance.toString()).toEqual((TOTAL_SUPPLY - transferAmount).toString());
    });

    // events are broken with solang:latest and this library
    xit('emits events', async function () {
        const spenderAccount = Keypair.generate().publicKey;
        const spendAmount = 9;

        const event = await new Promise<LogDescription>((resolve, reject) => {
            const listenerId = contract.addEventListener(async (event) => {
                await contract.removeEventListener(listenerId);
                resolve(event);
            });
            contract.approve(spenderAccount.toBytes(), spendAmount).catch(reject);
        });

        expect(event.name).toEqual('Approval');
        const [owner, spender, value] = event.args;
        expect(owner).toEqual(payerETHAddress);
        expect(spender.toString()).toEqual(spenderAccount.toString());
        expect(value.toString()).toEqual(spendAmount.toString());
    });
});
