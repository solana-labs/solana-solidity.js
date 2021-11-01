import { Connection, Keypair } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import { Abi, Contract, publicKeyToHex } from '../../src';

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

    const abi = JSON.parse(fs.readFileSync(path.join(exampleDir, `./build/${file}`), 'utf-8')) as Abi;
    const connection = getConnection();
    const payer = await newAccountWithLamports(connection);
    const program = Keypair.generate();
    const storage = Keypair.generate();
    const contract = new Contract(connection, program.publicKey, storage.publicKey, abi, payer);

    await contract.load(program, so, payer);

    const payerETHAddress = publicKeyToHex(payer.publicKey);

    const { events } = await contract.deploy(name, constructorArgs, program, storage, space);

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
    return new Connection(rpcUrl || process.env.RPC_URL || DEFAULT_URL, 'confirmed');
}

export async function newAccountWithLamports(connection: Connection, lamports = 10000000000): Promise<Keypair> {
    const account = Keypair.generate();

    let retries = 10;
    await connection.requestAirdrop(account.publicKey, lamports);
    for (;;) {
        await sleep(500);
        if (lamports == (await connection.getBalance(account.publicKey))) {
            return account;
        }
        if (--retries <= 0) {
            break;
        }
    }
    throw new Error(`airdrop of ${lamports} failed`);
}

export async function sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
