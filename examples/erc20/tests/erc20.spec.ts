import { LogDescription } from '@ethersproject/abi';
import { Keypair } from '@solana/web3.js';
import expect from 'expect';

import { Contract, publicKeyToHex } from '../../../src';
import { loadContract } from '../../utils';

const NAME = 'Solana';
const SYMBOL = 'SOL';
const TOTAL_SUPPLY = 10000;

describe('ERC20', () => {
    let contract: Contract;
    let payerETHAddress: string;

    it('deploys new contract', async function () {
        this.timeout(150000);
        ({ contract, payerETHAddress } = await loadContract(__dirname, [NAME, SYMBOL, TOTAL_SUPPLY]));

        const name = await contract.name();
        expect(name).toEqual(NAME);

        const symbol = await contract.symbol();
        expect(symbol).toEqual(SYMBOL);

        const decimals = await contract.decimals();
        expect(decimals).toEqual(18);

        const supply = await contract.totalSupply();
        expect(supply.toString()).toEqual(TOTAL_SUPPLY.toString());

        const balance = await contract.balanceOf(payerETHAddress);
        expect(balance.toString()).toEqual(TOTAL_SUPPLY.toString());
    });

    it('loads existing contract', async function () {
        contract = contract.clone();

        const name = await contract.name();
        expect(name).toEqual('Solana');
    });

    it('mutates contract state', async function () {
        const otherAccount = publicKeyToHex(Keypair.generate().publicKey);
        const transferAmount = 9;

        await contract.transfer(otherAccount, transferAmount);

        const otherAccountBalance = await contract.balanceOf(otherAccount);
        expect(otherAccountBalance.toString()).toEqual(transferAmount.toString());

        const payerBalance = await contract.balanceOf(payerETHAddress);
        expect(payerBalance.toString()).toEqual((TOTAL_SUPPLY - transferAmount).toString());
    });

    it('emits events', async function () {
        const spenderAccount = publicKeyToHex(Keypair.generate().publicKey);
        const spendAmount = 9;

        const event = await new Promise<LogDescription>((resolve, reject) => {
            const listenerId = contract.addEventListener(async (event) => {
                await contract.removeEventListener(listenerId);
                resolve(event);
            });
            contract.approve(spenderAccount, spendAmount).catch(reject);
        });

        expect(event.name).toEqual('Approval');
        const [owner, spender, value] = event.args;
        expect(owner).toEqual(payerETHAddress);
        expect(spender.toString()).toEqual(spenderAccount.toString());
        expect(value.toString()).toEqual(spendAmount.toString());
    });
});
