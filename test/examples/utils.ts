import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import { ABI, Contract } from '../../src';

const DEFAULT_URL = 'http://localhost:8899';

export async function loadContract(exampleDir: string, constructorArgs: any[] = [], name?: string, space = 8192 * 8) {
    const so = fs.readFileSync(path.join(exampleDir, './build/bundle.so'));

    let file: string;
    if (name) {
        file = `${name}.abi`;
    } else {
        file = fs.readdirSync(path.join(exampleDir, './build')).filter((n) => !~n.search('bundle.so'))[0];
        name = file.split('.abi')[0];
    }

    const abi = JSON.parse(fs.readFileSync(path.join(exampleDir, `./build/${file}`), 'utf-8')) as ABI;
    const connection = getConnection();
    const payer = await newAccountWithLamports(connection);
    const program = Keypair.generate();
    const storage = Keypair.generate();
    const contract = new Contract(connection, program.publicKey, storage.publicKey, abi, payer);

    await contract.load(program, so, payer);

    const payerETHAddress = payer.publicKey;

    const { events } = await contract.deploy(name, constructorArgs, storage, space);

    return {
        connection,
        payer,
        payerETHAddress,
        contract,
        abi,
        storage,
        events,
    };
}

export function getConnection(rpcUrl?: string): Connection {
    return new Connection(rpcUrl || process.env.RPC_URL || DEFAULT_URL, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 100000,
    });
}

export async function newAccountWithLamports(connection: Connection): Promise<Keypair> {
    const account = Keypair.generate();

    let signature = await connection.requestAirdrop(account.publicKey, LAMPORTS_PER_SOL);
    await connection.confirmTransaction(signature, 'confirmed');
    signature = await connection.requestAirdrop(account.publicKey, LAMPORTS_PER_SOL);
    await connection.confirmTransaction(signature, 'confirmed');
    signature = await connection.requestAirdrop(account.publicKey, LAMPORTS_PER_SOL);
    await connection.confirmTransaction(signature, 'confirmed');
    signature = await connection.requestAirdrop(account.publicKey, LAMPORTS_PER_SOL);
    await connection.confirmTransaction(signature, 'confirmed');

    return account;
}

export async function sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
