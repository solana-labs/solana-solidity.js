import {
  Keypair,
  PublicKey,
  TransactionInstruction,
  SYSVAR_CLOCK_PUBKEY,
} from '@solana/web3.js';
import { ethers } from 'ethers';

import { EventCallback, parseLogTopic } from './logs';
import { encodeSeeds, numToPaddedHex } from './utils';
import { Program } from './program';

export type ContractFunction<T = any> = (...args: Array<any>) => Promise<T>;

export type ContractDeployOptions = {
  name: string;
  abi: string;
  space: number;
  constructorArgs?: any[];
  accounts?: PublicKey[];
  writableAccounts?: PublicKey[];
  // programDerivedAccounts?: PublicKey[];
  seeds?: any[];
  signers?: Keypair[];
  caller?: PublicKey | undefined;
  value?: number;
  simulate?: boolean;
};

export type ContractTransactionOptions = {
  accounts?: PublicKey[];
  writableAccounts?: PublicKey[];
  programDerivedAccounts?: PublicKey[];
  seeds?: any[];
  signers?: Keypair[];
  caller?: PublicKey | undefined;
  value?: number;
  simulate?: boolean;
};

export type ContractDeployResult = {
  contract: Contract;
  computeUnitsUsed: number;
  logs: string[];
  events: ethers.utils.LogDescription[];
};

export type ContractCallResult = {
  result: ethers.utils.Result | null;
  computeUnitsUsed: number;
  logs: string[];
  events: ethers.utils.LogDescription[];
};

export class Contract {
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
      accounts = [],
      writableAccounts = [],
      seeds = [],
      signers = [],
      caller = program.payerAccount.publicKey,
      value = 0,
      simulate = false,
    } = options ?? {};

    const contractStorageAccount = await program.createStorageAccount(space);
    const abi = new ethers.utils.Interface(contractAbiData);
    const input = abi.encodeDeploy(constructorArgs);

    let hash = ethers.utils.keccak256(Buffer.from(contractName));

    const data = Buffer.concat([
      contractStorageAccount.publicKey.toBuffer(),
      caller.toBuffer(),
      Buffer.from(numToPaddedHex(value), 'hex'),
      Buffer.from(hash.substr(2, 8), 'hex'),
      encodeSeeds(seeds),
      Buffer.from(input.replace('0x', ''), 'hex'),
    ]);

    const keys = [
      // ...programDerivedAccounts.map((pubkey) => ({
      //   pubkey,
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

    const { logs, computeUnitsUsed } = await program.makeTx(
      simulate,
      [instruction],
      signers
    );

    const contract = new Contract(
      program,
      contractStorageAccount,
      contractAbiData
    );

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
    Object.values(this.abi.functions).forEach((frag) => {
      this.functions[frag.name] = this.buildCall(frag);
    });
  }

  /**
   *
   * @param fragment
   * @returns
   */
  buildCall(fragment: ethers.utils.Fragment): ContractFunction {
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
   *
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
    name: string,
    args: any[],
    options?: ContractTransactionOptions
  ): Promise<ContractCallResult> {
    const {
      accounts = [],
      writableAccounts = [],
      programDerivedAccounts = [],
      seeds = [],
      signers = [],
      caller = this.program.payerAccount.publicKey,
      value = 0,
      simulate = false,
    } = options ?? {};

    const fragment = this.abi.getFunction(name);
    const input = this.abi.encodeFunctionData(name, args);

    const data = Buffer.concat([
      this.contractStorageAccount.publicKey.toBuffer(),
      caller.toBuffer(),
      Buffer.from(numToPaddedHex(value), 'hex'),
      Buffer.from('00000000', 'hex'),
      encodeSeeds(seeds),
      Buffer.from(input.replace('0x', ''), 'hex'),
    ]);

    const keys = [
      ...programDerivedAccounts.map((pubkey) => ({
        pubkey,
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
      programId: this.getProgramKey(),
      data,
    });

    signers.unshift(this.program.payerAccount);

    const { encoded, logs, computeUnitsUsed } = await this.program.makeTx(
      simulate,
      [instruction],
      signers
    );

    let result: ethers.utils.Result | null = null;

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
   *
   * @returns
   */
  getProgramKey(): PublicKey {
    return this.program.programAccount.publicKey;
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
   *
   * @param logs
   * @returns
   */
  public parseLogsEvents(logs: string[]): ethers.utils.LogDescription[] {
    const events: ethers.utils.LogDescription[] = [];

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
