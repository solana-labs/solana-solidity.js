import {
  Keypair,
  PublicKey,
  TransactionInstruction,
  Transaction,
  sendAndConfirmTransaction,
  SYSVAR_CLOCK_PUBKEY,
} from '@solana/web3.js';
import { ethers } from 'ethers';

import { EventCallback } from './events';
import { encodeSeeds } from './utils';
import { Program } from './program';

const LOG_RETURN_PREFIX = 'Program return: ';
const LOG_LOG_PREFIX = 'Program log: ';
const LOG_COMPUTE_UNITS_RE = /consumed (\d+) of (\d+) compute units/i;

export type ContractFunction<T = any> = (...args: Array<any>) => Promise<T>;

export class TxError extends Error {
  public logs: string[];
  public computeUnitsUsed: number;
}

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
  readonly simulate: { [name: string]: ContractFunction };

  constructor(
    public program: Program,
    public contractStorageAccount: Keypair,
    public abiData: string
  ) {
    this.abi = new ethers.utils.Interface(abiData);
    this.functions = {};
    this.simulate = {};
    Object.entries(this.abi.functions).forEach(([, frag]) => {
      this.functions[frag.name] = this.buildCall(frag);
      this.simulate[frag.name] = this.buildSimulateCall(frag);
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

  buildSimulateCall(fragment: ethers.utils.Fragment): ContractFunction {
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
        return this.simulateCall(
          fragment.name,
          args,
          pubkeys,
          seeds,
          signers,
          caller
        );
      } else {
        return this.simulateCall(fragment.name, args);
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
        throw new Error('error is not falsy');
      }

      const { log, encoded, computeUnitsUsed } = this.parseTxLogs(logs!);

      throw this.parseTxError(encoded, computeUnitsUsed, log, logs);
    }

    const parsedTx =
      await this.program.connection.getParsedConfirmedTransaction(sig);
    const logs = parsedTx!.meta?.logMessages!;
    const { encoded } = this.parseTxLogs(logs);

    if (fragment.outputs?.length) {
      if (!encoded) {
        throw new Error('return data not set');
      }

      return this.abi.decodeFunctionResult(fragment, encoded);
    } else {
      return [];
    }
  }

  private async simulateCall(
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

    const {
      value: { err, logs },
    } = await this.program.connection.simulateTransaction(
      new Transaction().add(instruction),
      signers
    );
    // console.log(logs);
    const { encoded, computeUnitsUsed, log } = this.parseTxLogs(logs!);

    if (err) {
      throw this.parseTxError(encoded, computeUnitsUsed, log, logs);
    }

    if (fragment.outputs?.length) {
      if (!encoded) {
        throw new Error('return data not set');
      }

      return this.abi.decodeFunctionResult(fragment, encoded);
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
  public on(eventName: string, callback: EventCallback): number {
    return this.program.events.addEventListener(this.abi, eventName, callback);
  }

  /**
   * Unsubscribes from the given eventName.
   */
  public async off(listener: number): Promise<void> {
    return await this.program.events.removeEventListener(listener);
  }

  private parseTxLogs(logs: string[]) {
    let encoded = null;
    let computeUnitsUsed = 0;
    let log;

    for (let message of logs) {
      // return
      if (message.startsWith(LOG_RETURN_PREFIX)) {
        let [, returnData] = message.slice(LOG_RETURN_PREFIX.length).split(' ');
        encoded = Buffer.from(returnData, 'base64');
      }

      // log
      if (message.startsWith(LOG_LOG_PREFIX)) {
        log = message.slice(LOG_LOG_PREFIX.length);
      }

      // compute units used
      const computeUnitsUsedMatch = message.match(LOG_COMPUTE_UNITS_RE);
      if (computeUnitsUsedMatch) {
        computeUnitsUsed = Number(computeUnitsUsedMatch[1]);
      }
    }

    return { encoded, computeUnitsUsed, log };
  }

  private parseTxError(
    encoded: Buffer | null,
    computeUnitsUsed: number,
    log: string,
    logs: string[]
  ) {
    let txErr: TxError;

    if (log) {
      txErr = new TxError(log);
    } else {
      if (!encoded) {
        txErr = new TxError('return data or log not set');
      } else if (encoded?.readUInt32BE(0) != 0x08c379a0) {
        txErr = new TxError('signature not correct');
      } else {
        const revertReason = ethers.utils.defaultAbiCoder.decode(
          ['string'],
          ethers.utils.hexDataSlice(encoded, 4)
        );
        // console.log(revertReason.toString(), computeUnitsUsed);
        txErr = new TxError(revertReason.toString());
      }
    }

    txErr.logs = logs;
    txErr.computeUnitsUsed = computeUnitsUsed;
    return txErr;
  }
}
