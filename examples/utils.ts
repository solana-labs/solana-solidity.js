import path from 'path';
import fs from 'fs';
import { Connection } from '@solana/web3.js';

import { Contract, Program, newAccountWithLamports, pubKeyToHex } from '../src';

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
  const wallet = pubKeyToHex(program.payerAccount.publicKey);

  const contract = await program.deployContract(
    contractFile.split('.abi')[0],
    contractAbi,
    constructorArgs,
    {
      contractStorageSize: 8192 * 8,
    }
  );

  return { connection, payerAccount, program, wallet, contract, contractAbi };
}

export function getConnection(rpcUrl?: string): Connection {
  let url = rpcUrl || process.env.RPC_URL || DEFAULT_URL;
  return new Connection(url, 'confirmed');
}
