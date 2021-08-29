import {
  Keypair,
  Connection,
  BpfLoader,
  BPF_LOADER_PROGRAM_ID,
  PublicKey,
} from '@solana/web3.js';

const DEFAULT_URL: string = 'http://localhost:8899';

export function sleep(ms: number) {
  return new Promise(function (res) {
    setTimeout(res, ms);
  });
}

export async function createProgramAddress(
  program: PublicKey,
  salt: Buffer
): Promise<any> {
  for (let bump = 0; bump < 256; bump++) {
    let seed = Buffer.concat([salt, Uint8Array.from([bump])]);

    let pda: any = undefined;

    await PublicKey.createProgramAddress([seed], program)
      .then((v) => {
        pda = v;
      })
      .catch((_) => {});

    if (pda) {
      return { address: pda, seed };
    }
  }
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
    console.log('airdrop retry ' + retries);
  }
  throw new Error(`airdrop of ${lamports} failed`);
}

export function getConnection(): Connection {
  let url = process.env.RPC_URL || DEFAULT_URL;
  return new Connection(url, 'recent');
}

export async function loadProgram(
  connection: Connection,
  payerAccount: Keypair,
  programAccount: Keypair,
  so: Buffer
) {
  await BpfLoader.load(
    connection,
    payerAccount,
    programAccount,
    so,
    BPF_LOADER_PROGRAM_ID
  );
}

export function encodeSeeds(seeds: any[]): Buffer {
  let seedEncoded = Buffer.alloc(
    1 + seeds.map((seed) => seed.seed.length + 1).reduce((a, b) => a + b, 0)
  );

  seedEncoded.writeUInt8(seeds.length);
  let offset = 1;

  seeds.forEach((v) => {
    let seed = v.seed;

    seedEncoded.writeUInt8(seed.length, offset);
    offset += 1;
    seed.copy(seedEncoded, offset);
    offset += seed.length;
  });

  return seedEncoded;
}

export function pubKeyToHex(publicKey: PublicKey): string {
  return '0x' + publicKey.toBuffer().toString('hex');
}
