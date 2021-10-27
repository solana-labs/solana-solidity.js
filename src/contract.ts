import {
  Keypair,
  PublicKey,
  TransactionInstruction,
  SYSVAR_CLOCK_PUBKEY,
} from '@solana/web3.js';
import {
  LogDescription,
  Interface,
  Fragment,
  Result,
} from '@ethersproject/abi';
import { keccak256 } from '@ethersproject/keccak256';

import { EventCallback, parseLogTopic } from './logs';
import { numToPaddedHex, encodeSeeds } from './utils';
import { Program } from './program';

export type ProgramDerivedAddress = {
  account: PublicKey;
  seed: Buffer;
};

export type ContractFunction<T = any> = (...args: Array<any>) => Promise<T>;

export type ContractDeployOptions = {
  name: string;
  abi: string;
  space: number;
  constructorArgs?: any[];
  accounts?: PublicKey[];
  writableAccounts?: PublicKey[];
  programDerivedAddresses?: ProgramDerivedAddress[];
  storageKeyPair: Keypair;
  signers?: Keypair[];
  caller?: PublicKey | undefined;
  value?: number;
  simulate?: boolean;
};

export type ContractFunctionCallOptions = {
  accounts?: PublicKey[];
  writableAccounts?: PublicKey[];
  programDerivedAddresses?: ProgramDerivedAddress[];
  signers?: Keypair[];
  caller?: PublicKey | undefined;
  value?: number;
  simulate?: boolean;
};

export type ContractDeployResult = {
  contract: Contract;
  computeUnitsUsed: number;
  logs: string[];
  events: LogDescription[];
};

export type ContractCallResult = {
  result: Result | null;
  computeUnitsUsed: number;
  logs: string[];
  events: LogDescription[];
};

export class Contract {
  public program: Program;
  public storageAccount: PublicKey;
  public abiData: string;

  /**
   * Deploy a new contract to a loaded Solang program
   *
   * @param program
   * @param options
   * @returns
   */
  static async deploy(
    program: Program,
    options: ContractDeployOptions
  ): Promise<ContractDeployResult> {
    const {
      name: contractName,
      abi: contractAbiData,
      space,
      constructorArgs,
      storageKeyPair,
      accounts = [],
      writableAccounts = [],
      programDerivedAddresses = [],
      signers = [],
      caller = program.payerAccount.publicKey,
      value = 0,
      simulate = false,
    } = options ?? {};

    await program.createStorageAccount(storageKeyPair, space);
    const storageAccount = storageKeyPair.publicKey;
    const abi = new Interface(contractAbiData);
    const input = abi.encodeDeploy(constructorArgs);

    let hash = keccak256(Buffer.from(contractName));

    const seeds = programDerivedAddresses.map((pda) => pda.seed);

    const data = Buffer.concat([
      storageKeyPair.publicKey.toBuffer(), //           contract
      caller.toBuffer(), //                             sender
      Buffer.from(numToPaddedHex(value), 'hex'), //     value
      Buffer.from(hash.substr(2, 8), 'hex'), //         hash
      encodeSeeds(seeds), //                                         seeds
      Buffer.from(input.replace('0x', ''), 'hex'), //   input
    ]);

    const keys = [
      // ...programDerivedAddresses.map((pubkey) => ({
      //   pubkey,
      //   isSigner: false,
      //   isWritable: true,
      // })),
      {
        pubkey: storageAccount,
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

    const { logs, computeUnitsUsed } = await (simulate
      ? program.simulateTransaction
      : program.sendAndConfirmTransaction
    ).call(program, [instruction], signers);

    const contract = new Contract(program, storageAccount, contractAbiData);

    const events = contract.parseLogsEvents(logs);

    return {
      contract,
      logs,
      computeUnitsUsed,
      events,
    };
  }

  /**
   * Load a deployed contract
   *
   * @param program
   * @param abiData
   * @param storageAccount
   * @returns
   */
  static async get(
    program: Program,
    abiData: string,
    storageAccount: PublicKey
  ): Promise<Contract> {
    return new Contract(program, storageAccount, abiData);
  }

  public abi: Interface;
  readonly functions: { [name: string]: ContractFunction };

  /**
   * Creates a new instance of Contract
   *
   * @param program
   * @param storageAccount
   * @param abiData
   */
  constructor(_program: Program, _storageAccount: PublicKey, _abiData: string) {
    this.program = _program;
    this.storageAccount = _storageAccount;
    this.abiData = _abiData;
    this.abi = new Interface(_abiData);
    this.functions = {};
    Object.values(this.abi.functions).forEach((frag) => {
      this.functions[frag.name] = this.buildCall(frag);
    });
  }

  /**
   * Generate contract method for `fragment` of type "function"
   *
   * @param fragment
   * @returns
   */
  buildCall(fragment: Fragment): ContractFunction {
    return (...args: Array<any>) => {
      const last = args[args.length - 1];
      if (args.length > fragment.inputs.length && typeof last === 'object') {
        return this.call(
          fragment.name,
          args.slice(0, fragment.inputs.length),
          last
        );
      } else {
        return this.call(fragment.name, args);
      }
    };
  }

  /**
   * Invoke contract method `name` with `args` as it's arguments
   *
   * @param name
   * @param args
   * @param options
   * @returns
   */
  protected async call(
    name: string,
    args: any[],
    options?: ContractFunctionCallOptions
  ): Promise<ContractCallResult> {
    const {
      accounts = [],
      writableAccounts = [],
      programDerivedAddresses = [],
      signers = [],
      caller = this.program.payerAccount.publicKey,
      value = 0,
      simulate = false,
    } = options ?? {};

    const fragment = this.abi.getFunction(name);
    const input = this.abi.encodeFunctionData(name, args);

    const seeds = programDerivedAddresses.map((pda) => pda.seed);

    const data = Buffer.concat([
      this.storageAccount.toBuffer(), //                contract
      caller.toBuffer(), //                             sender
      Buffer.from(numToPaddedHex(value), 'hex'), //     value
      Buffer.from('00000000', 'hex'), //                hash
      encodeSeeds(seeds), //                                         seeds
      Buffer.from(input.replace('0x', ''), 'hex'), //   input
    ]);

    const keys = [
      ...programDerivedAddresses.map((pda) => ({
        pubkey: pda.account,
        isSigner: false,
        isWritable: true,
      })),
      {
        pubkey: this.storageAccount,
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
      programId: this.getProgramKey(),
      data,
    });

    signers.unshift(this.program.payerAccount);

    const { encoded, logs, computeUnitsUsed } = await (simulate
      ? this.program.simulateTransaction
      : this.program.sendAndConfirmTransaction
    ).call(this.program, [instruction], signers);

    let result: Result | null = null;

    if (fragment.outputs?.length) {
      if (!encoded) {
        throw new Error('return data not set');
      }

      result = this.abi.decodeFunctionResult(fragment, encoded);
      if (fragment.outputs.length === 1) {
        result = result[0];
      }
    }

    const events = this.parseLogsEvents(logs);

    return { result, logs, computeUnitsUsed, events };
  }

  /**
   * Return the programs's account public key
   *
   * @returns PublicKey
   */
  getProgramKey(): PublicKey {
    return this.program.programAccount.publicKey;
  }

  /**
   * Invokes the given callback every time the given event is emitted
   *
   * @param callback  The function to invoke whenever the event is emitted from
   *                  program logs.
   */
  public addEventListener(callback: EventCallback): number {
    return this.program.addEventListener(this.abi, callback);
  }

  /**
   * Unsubscribes from the given eventName.
   */
  public async removeEventListener(listener: number): Promise<void> {
    return await this.program.removeEventListener(listener);
  }

  /**
   * Parse event `logs` for any events emitted
   *
   * @param logs  Array of log strings
   * @returns     Decoded event data
   */
  public parseLogsEvents(logs: string[]): LogDescription[] {
    const events: LogDescription[] = [];

    for (const log of logs) {
      const eventData = parseLogTopic(log);
      if (eventData) {
        const event = this.abi.parseLog(eventData);
        events.push(event);
      }
    }

    return events;
  }
}
