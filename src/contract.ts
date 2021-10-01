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
import { parseTxError, parseTxLogs } from './logs';

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
      Buffer.from('0000000000000000', 'hex'),
      Buffer.from(hash.substr(2, 8), 'hex'),
      encodeSeeds(seeds),
      Buffer.from(input.replace('0x', ''), 'hex'),
    ]);

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

    const signers = [program.payerAccount];

    let sig;
    try {
      sig = await sendAndConfirmTransaction(
        program.connection,
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
      } = await program.connection.simulateTransaction(
        new Transaction().add(instruction),
        signers
      );
      // console.log(logs);

      if (!err) {
        throw new Error('error is not falsy');
      }

      const { log, encoded, computeUnitsUsed } = parseTxLogs(logs!);
      throw parseTxError(encoded, computeUnitsUsed, log, logs);
    }

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
      this.functions[frag.name] = this.buildCall(false, frag);
      this.simulate[frag.name] = this.buildCall(true, frag);
    });
  }

  buildCall(
    simulate: boolean,
    fragment: ethers.utils.Fragment
  ): ContractFunction {
    return (...args: Array<any>) => {
      const last = args[args.length - 1];
      if (args.length > fragment.inputs.length && typeof last === 'object') {
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
        return this.call(
          simulate,
          fragment.name,
          args.slice(0, fragment.inputs.length),
          pubkeys,
          seeds,
          signers,
          caller
        );
      } else {
        return this.call(simulate, fragment.name, args);
      }
    };
  }

  private async call(
    simulate: boolean,
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
      Buffer.from('0000000000000000', 'hex'),
      Buffer.from('00000000', 'hex'),
      encodeSeeds(seeds),
      Buffer.from(input.replace('0x', ''), 'hex'),
    ]);

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

    let encoded;

    if (simulate) {
      const {
        value: { err, logs },
      } = await this.program.connection.simulateTransaction(
        new Transaction().add(instruction),
        signers
      );
      // console.log(logs);
      const { encoded: _encoded, computeUnitsUsed, log } = parseTxLogs(logs!);

      encoded = _encoded;

      if (err) {
        throw parseTxError(encoded, computeUnitsUsed, log, logs);
      }
    } else {
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

        const { log, encoded: _encoded, computeUnitsUsed } = parseTxLogs(logs!);
        encoded = _encoded;
        throw parseTxError(encoded, computeUnitsUsed, log, logs);
      }

      const parsedTx =
        await this.program.connection.getParsedConfirmedTransaction(sig);
      const logs = parsedTx!.meta?.logMessages!;
      // console.log(logs);

      const { encoded: _encoded } = parseTxLogs(logs);
      encoded = _encoded;
    }

    if (fragment.outputs?.length) {
      if (!encoded) {
        throw new Error('return data not set');
      }

      const result = this.abi.decodeFunctionResult(fragment, encoded);
      if (fragment.outputs.length === 1) {
        return result[0];
      }
      return result;
    }
    return null;
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
  public addEventListener(eventName: string, callback: EventCallback): number {
    return this.program.events.addEventListener(this.abi, eventName, callback);
  }

  /**
   * Unsubscribes from the given eventName.
   */
  public async removeEventListener(listener: number): Promise<void> {
    return await this.program.events.removeEventListener(listener);
  }
}
