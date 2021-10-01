import {
  Keypair,
  PublicKey,
  TransactionInstruction,
  Transaction,
  sendAndConfirmTransaction,
  SYSVAR_CLOCK_PUBKEY,
} from '@solana/web3.js';
import { ethers } from 'ethers';

import { EventCallback } from './logs';
import { encodeSeeds } from './utils';
import { Program } from './program';
import { parseTxError, parseTxLogs } from './logs';

export type ContractFunction<T = any> = (...args: Array<any>) => Promise<T>;

export type ContractDeployOptions = {
  accounts?: PublicKey[];
  writableAccounts?: PublicKey[];
  seeds?: any[];
  signers?: Keypair[];
  caller?: PublicKey | undefined;
  contractStorageSize?: number;
};

export type ContractTransactionOptions = {
  accounts?: PublicKey[];
  writableAccounts?: PublicKey[];
  seeds?: any[];
  signers?: Keypair[];
  caller?: PublicKey | undefined;
};

export class Contract {
  /**
   * Deploy a new contract to a loaded Solang program
   *
   * @param program
   * @param contractName
   * @param contractAbiData
   * @param constructorParams
   * @param seeds
   * @param contractStorageSize
   * @returns
   */
  static async deploy(
    program: Program,
    contractName: string,
    contractAbiData: string,
    constructorArgs: any[],
    options?: ContractDeployOptions
  ): Promise<Contract> {
    const {
      accounts = [],
      writableAccounts = [],
      seeds = [],
      signers = [],
      caller = undefined,
      contractStorageSize = 2048,
    } = options ?? {};

    const contractStorageAccount = await program.createStorageAccount(
      contractStorageSize
    );
    const abi = new ethers.utils.Interface(contractAbiData);
    const input = abi.encodeDeploy(constructorArgs);

    let hash = ethers.utils.keccak256(Buffer.from(contractName));

    const data = Buffer.concat([
      contractStorageAccount.publicKey.toBuffer(),
      (caller || program.payerAccount.publicKey).toBuffer(),
      Buffer.from('0000000000000000', 'hex'),
      Buffer.from(hash.substr(2, 8), 'hex'),
      encodeSeeds(seeds),
      Buffer.from(input.replace('0x', ''), 'hex'),
    ]);

    const keys = [
      // ...seeds.map((seed) => ({
      //   pubkey: seed.address,
      //   isSigner: false,
      //   isWritable: true,
      // })),
      {
        pubkey: contractStorageAccount.publicKey,
        isSigner: false,
        isWritable: true,
      },
      // {
      //   pubkey: SYSVAR_CLOCK_PUBKEY,
      //   isSigner: false,
      //   isWritable: false,
      // },
      // {
      //   pubkey: PublicKey.default,
      //   isSigner: false,
      //   isWritable: false,
      // },
      ...accounts.map((pubkey) => ({
        pubkey,
        isSigner: false,
        isWritable: false,
      })),
      ...writableAccounts.map((pubkey) => ({
        pubkey,
        isSigner: false,
        isWritable: true,
      })),
    ];

    signers.unshift(program.payerAccount);

    const instruction = new TransactionInstruction({
      keys,
      programId: program.programAccount.publicKey,
      data,
    });

    try {
      await sendAndConfirmTransaction(
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

  /**
   * Loaded a dpeloyed a contract
   *
   * @param program
   * @param abiData
   * @param contractStorageAccount
   * @returns
   */
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

  /**
   *
   * @param program
   * @param contractStorageAccount
   * @param abiData
   */
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

  /**
   *
   * @param simulate
   * @param fragment
   * @returns
   */
  buildCall(
    simulate: boolean,
    fragment: ethers.utils.Fragment
  ): ContractFunction {
    return (...args: Array<any>) => {
      const last = args[args.length - 1];
      if (args.length > fragment.inputs.length && typeof last === 'object') {
        return this.call(
          simulate,
          fragment.name,
          args.slice(0, fragment.inputs.length),
          last
        );
      } else {
        return this.call(simulate, fragment.name, args);
      }
    };
  }

  /**
   *
   * @param simulate
   * @param name
   * @param params
   * @param accounts
   * @param writableAccounts
   * @param seeds
   * @param signers
   * @param caller
   * @returns
   */
  private async call(
    simulate: boolean,
    name: string,
    args: any[],
    options?: ContractTransactionOptions
  ): Promise<ethers.utils.Result> {
    const {
      accounts = [],
      writableAccounts = [],
      seeds = [],
      signers = [],
      caller,
    } = options ?? {};

    const fragment = this.abi.getFunction(name);
    const input = this.abi.encodeFunctionData(name, args);

    const data = Buffer.concat([
      this.contractStorageAccount.publicKey.toBuffer(),
      (caller || this.program.payerAccount.publicKey).toBuffer(),
      Buffer.from('0000000000000000', 'hex'),
      Buffer.from('00000000', 'hex'),
      encodeSeeds(seeds),
      Buffer.from(input.replace('0x', ''), 'hex'),
    ]);

    const keys = [
      ...seeds.map((seed) => ({
        pubkey: seed.address,
        isSigner: false,
        isWritable: true,
      })),
      {
        pubkey: this.contractStorageAccount.publicKey,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: SYSVAR_CLOCK_PUBKEY,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: PublicKey.default,
        isSigner: false,
        isWritable: false,
      },
      ...accounts.map((pubkey) => ({
        pubkey,
        isSigner: false,
        isWritable: false,
      })),
      ...writableAccounts.map((pubkey) => ({
        pubkey,
        isSigner: false,
        isWritable: true,
      })),
    ];

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

  /**
   *
   * @param test
   * @param upto
   * @returns
   */
  async contractStorage(test: Program, upto: number): Promise<Buffer> {
    const accountInfo = await test.connection.getAccountInfo(
      this.contractStorageAccount.publicKey
    );

    return accountInfo!.data;
  }

  /**
   *
   * @returns
   */
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
    return this.program.addEventListener(this.abi, eventName, callback);
  }

  /**
   * Unsubscribes from the given eventName.
   */
  public async removeEventListener(listener: number): Promise<void> {
    return await this.program.removeEventListener(listener);
  }
}
