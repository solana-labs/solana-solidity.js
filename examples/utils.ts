import path from 'path';
import fs from 'fs';
import { Connection, Keypair } from '@solana/web3.js';

import { Program, pubKeyToHex } from '../src';

const DEFAULT_URL: string = 'http://localhost:8899';

export async function loadContract(
  exampleDir: string,
  constructorArgs: any[] = []
) {
  const programSo = fs.readFileSync(
    path.join(exampleDir, '../build/bundle.so')
  );
  const contractFile = fs
    .readdirSync(path.join(exampleDir, '../build'))
    .filter((n) => !~n.search('bundle.so'))[0];
  const contractAbi = fs.readFileSync(
    path.join(exampleDir, `../build/${contractFile}`),
    'utf-8'
  );
  const connection = getConnection();
  const payerAccount = await newAccountWithLamports(connection);
  const program = await Program.deploy(connection, payerAccount, programSo);
  const payerETHAddress = pubKeyToHex(payerAccount.publicKey);

  const { contract } = await program.deployContract({
    name: contractFile.split('.abi')[0],
    abi: contractAbi,
    space: 8192 * 8,
    constructorArgs,
  });

  return {
    connection,
    payerAccount,
    program,
    payerETHAddress,
    contract,
    contractAbi,
  };
}

export function getConnection(rpcUrl?: string): Connection {
  let url = rpcUrl || process.env.RPC_URL || DEFAULT_URL;
  return new Connection(url, 'confirmed');
}

export async function newAccountWithLamports(
  connection: Connection,
  lamports: number = 10000000000
): Promise<Keypair> {
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
    // console.log('airdrop retry ' + retries);
  }
  throw new Error(`airdrop of ${lamports} failed`);
}

export function sleep(ms: number) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}
