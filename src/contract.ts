import {
  Keypair,
  PublicKey,
  TransactionInstruction,
  Transaction,
  sendAndConfirmTransaction,
  SYSVAR_CLOCK_PUBKEY,
} from '@solana/web3.js';
import { ethers } from 'ethers';

const returnDataPrefix = 'Program return: ';

import { encodeSeeds } from './utils';
import { Program } from './program';
import { encode } from 'querystring';

export type ContractFunction<T = any> = (...args: Array<any>) => Promise<T>;

export class Contract {
  static async deploy(
    program: Program,
    contractName: string,
    contractAbiData: string,
    constructorParams: any[],
    seeds: any[] = [],
    contractStorageSize: number = 2048
  ): Promise<Contract> {
    const contractStorageAccount = await program.createStorageAccount(
      contractStorageSize
    );
    const abi = new ethers.utils.Interface(contractAbiData);
    const input = abi.encodeDeploy(constructorParams);

    let hash = ethers.utils.keccak256(Buffer.from(contractName));

    const data = Buffer.concat([
      contractStorageAccount.publicKey.toBuffer(),
      program.payerAccount.publicKey.toBuffer(),
      Buffer.from(hash.substr(2, 8), 'hex'),
      encodeSeeds(seeds),
      Buffer.from(input.replace('0x', ''), 'hex'),
    ]);

    // debug('calling constructor [' + constructorParams + ']');

    const instruction = new TransactionInstruction({
      keys: [
        {
          pubkey: contractStorageAccount.publicKey,
          isSigner: false,
          isWritable: true,
        },
      ],
      programId: program.programAccount.publicKey,
      data,
    });

    await sendAndConfirmTransaction(
      program.connection,
      new Transaction().add(instruction),
      [program.payerAccount],
      {
        skipPreflight: false,
        commitment: 'confirmed',
        preflightCommitment: undefined,
      }
    );

    return new Contract(program, contractStorageAccount, contractAbiData);
  }

  static async get(
    program: Program,
    abiData: string,
    contractStorageAccount: Keypair
  ): Promise<Contract> {
    return new Contract(program, contractStorageAccount, abiData);
  }

  public abi: ethers.utils.Interface;
  readonly functions: { [name: string]: ContractFunction };

  constructor(
    public program: Program,
    public contractStorageAccount: Keypair,
    public abiData: string
  ) {
    this.abi = new ethers.utils.Interface(abiData);
    this.functions = {};
    Object.entries(this.abi.functions).forEach(([, frag]) => {
      this.functions[frag.name] = this.buildCall(frag);
    });
  }

  buildCall(fragment: ethers.utils.Fragment): ContractFunction {
    return (...args: Array<any>) => {
      const last = args[args.length - 1];
      if (typeof last === 'object') {
        const {
          pubkeys,
          seeds,
          signers,
          caller,
        }: {
          pubkeys: PublicKey[];
          seeds: any[];
          signers: Keypair[];
          caller: PublicKey | undefined;
        } = last;
        return this.call(fragment.name, args, pubkeys, seeds, signers, caller);
      } else {
        return this.call(fragment.name, args);
      }
    };
  }

  private async call(
    name: string,
    params: any[],
    pubkeys: PublicKey[] = [],
    seeds: any[] = [],
    signers: Keypair[] = [],
    caller: PublicKey | undefined = undefined
  ): Promise<ethers.utils.Result> {
    const fragment = this.abi.getFunction(name);
    const input = this.abi.encodeFunctionData(name, params);

    const data = Buffer.concat([
      this.contractStorageAccount.publicKey.toBuffer(),
      (caller || this.program.payerAccount.publicKey).toBuffer(),
      Buffer.from('00000000', 'hex'),
      encodeSeeds(seeds),
      Buffer.from(input.replace('0x', ''), 'hex'),
    ]);

    // debug('calling function ' + name + ' [' + params + ']');

    const keys = [];
    seeds.forEach((seed) => {
      keys.push({ pubkey: seed.address, isSigner: false, isWritable: true });
    });
    keys.push({
      pubkey: this.contractStorageAccount.publicKey,
      isSigner: false,
      isWritable: true,
    });
    keys.push({
      pubkey: SYSVAR_CLOCK_PUBKEY,
      isSigner: false,
      isWritable: false,
    });
    keys.push({
      pubkey: PublicKey.default,
      isSigner: false,
      isWritable: false,
    });
    for (let i = 0; i < pubkeys.length; i++) {
      keys.push({
        pubkey: pubkeys[i],
        isSigner: false,
        isWritable: (i & 1) == 1,
      });
    }

    const instruction = new TransactionInstruction({
      keys,
      programId: this.program.programAccount.publicKey,
      data,
    });

    signers.unshift(this.program.payerAccount);

    let sig;
    try {
      sig = await sendAndConfirmTransaction(
        this.program.connection,
        new Transaction().add(instruction),
        signers,
        {
          skipPreflight: false,
          commitment: 'confirmed',
          preflightCommitment: undefined,
        }
      );
    } catch {
      const {
        value: { err, logs },
      } = await this.program.connection.simulateTransaction(
        new Transaction().add(instruction),
        signers
      );
      // console.log(logs);

      if (!err) {
        throw 'error is not falsy';
      }

      const encoded = this.parseTxLogs(logs!);

      if (!encoded) {
        throw 'return data not set';
      }

      if (encoded?.readUInt32BE(0) != 0x08c379a0) {
        throw 'signature not correct';
      }

      const revertReason = ethers.utils.defaultAbiCoder.decode(
        ['string'],
        ethers.utils.hexDataSlice(encoded, 4)
      );
      // console.log(revertReason.toString());

      throw new Error(revertReason.toString());
    }

    if (fragment.outputs?.length) {
      const parsedTx =
        await this.program.connection.getParsedConfirmedTransaction(sig);
      const logs = parsedTx!.meta?.logMessages!;
      const encoded = this.parseTxLogs(logs);
      const returns = this.abi.decodeFunctionResult(fragment, encoded);

      // let debug = ' returns [';
      // for (let i = 0; i.toString() in returns; i++) {
      //   debug += returns[i];
      // }
      // debug += ']';
      // console.log(debug);

      return returns;
    } else {
      return [];
    }
  }

  async contractStorage(test: Program, upto: number): Promise<Buffer> {
    const accountInfo = await test.connection.getAccountInfo(
      this.contractStorageAccount.publicKey
    );

    return accountInfo!.data;
  }

  getStorageKeyPair(): Keypair {
    return this.contractStorageAccount;
  }

  /**
   * Invokes the given callback every time the given event is emitted.
   *
   * @param eventName The PascalCase name of the event, provided by the IDL.
   * @param callback  The function to invoke whenever the event is emitted from
   *                  program logs.
   */
  public on(
    eventName: string,
    callback: (event: any, slot: number) => void
  ): number {
    return this.program.events.addEventListener(eventName, callback);
  }

  /**
   * Unsubscribes from the given eventName.
   */
  public async off(listener: number): Promise<void> {
    return await this.program.events.removeEventListener(listener);
  }

  private parseTxLogs(logs: string[]) {
    let encoded = null;
    for (let message of logs) {
      if (message.startsWith(returnDataPrefix)) {
        let [, returnData] = message.slice(returnDataPrefix.length).split(' ');
        encoded = Buffer.from(returnData, 'base64');
      }
    }
    return encoded;
  }
}
