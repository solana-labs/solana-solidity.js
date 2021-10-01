import {
  Keypair,
  Connection,
  BpfLoader,
  BPF_LOADER_PROGRAM_ID,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { ethers } from 'ethers';

import { Contract, ContractDeployOptions } from './contract';
import { LogsParser, LogCallback, EventCallback } from './logs';
export class Program {
  private logs: LogsParser;

  /**
   * Load a new Solang-compiled program
   *
   * @param connection    Solana connection
   * @param payerAccount  Payer pubkey
   * @param so            Solang program build bundle
   * @returns             The program
   */
  static async deploy(
    connection: Connection,
    payerAccount: Keypair,
    so: Buffer
  ): Promise<Program> {
    const programAccount = Keypair.generate();

    await BpfLoader.load(
      connection,
      payerAccount,
      programAccount,
      so,
      BPF_LOADER_PROGRAM_ID
    );

    return new Program(connection, payerAccount, programAccount);
  }

  /**
   *
   * Load a deployed Solang-compiled program
   *
   * @param connection      Solana connection
   * @param payerAccount    Payer pubkey
   * @param programAccount  The program's pubkey
   * @param so              Solang program build bundle
   * @returns               The program
   */
  static async get(
    connection: Connection,
    payerAccount: Keypair,
    programAccount: Keypair,
    so: Buffer
  ): Promise<Program> {
    await BpfLoader.load(
      connection,
      payerAccount,
      programAccount,
      so,
      BPF_LOADER_PROGRAM_ID
    );

    return new Program(connection, payerAccount, programAccount);
  }

  /**
   *
   * @param connection      Solana connection
   * @param payerAccount    Payer pubkey
   * @param programAccount  The program's pubkey
   */
  constructor(
    public connection: Connection,
    public payerAccount: Keypair,
    public programAccount: Keypair
  ) {
    this.logs = new LogsParser(this.connection);
  }

  /**
   * Create a storage account
   *
   * @param space
   * @returns
   */
  async createStorageAccount(space: number): Promise<Keypair> {
    const lamports = await this.connection.getMinimumBalanceForRentExemption(
      space
    );

    let account = Keypair.generate();

    const transaction = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: this.payerAccount.publicKey,
        newAccountPubkey: account.publicKey,
        lamports,
        space,
        programId: this.programAccount.publicKey,
      })
    );

    await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.payerAccount, account],
      {
        skipPreflight: false,
        commitment: 'confirmed',
        preflightCommitment: undefined,
      }
    );

    return account;
  }

  /**
   * Invokes the given callback on every program log.
   *
   * @param callback  The function to invoke whenever the event is emitted from
   *                  program logs.
   */
  public addLogListener(callback: LogCallback): number {
    return this.logs.addLogListener(callback);
  }

  /**
   * Unsubscribes from the given log listener id.
   *
   * @param listenerId: The log listener id
   */
  public async removeLogListener(listenerId: number): Promise<void> {
    return await this.logs.removeLogListener(listenerId);
  }

  /**
   * Invokes the given callback every time the given event is emitted.
   *
   * @param eventName The PascalCase name of the event, provided by the IDL.
   * @param callback  The function to invoke whenever the event is emitted from
   *                  program logs.
   */
  public addEventListener(
    abi: ethers.utils.Interface,
    eventName: string,
    callback: EventCallback
  ): number {
    return this.logs.addEventListener(abi, eventName, callback);
  }

  /**
   * Unsubscribes from the given eventName.
   */
  public async removeEventListener(listener: number): Promise<void> {
    return await this.logs.removeEventListener(listener);
  }

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
  async deployContract(
    contractName: string,
    contractAbiData: string,
    constructorArgs: any[],
    options?: ContractDeployOptions
  ): Promise<Contract> {
    return Contract.deploy(
      this,
      contractName,
      contractAbiData,
      constructorArgs,
      options
    );
  }

  /**
   * Load a deployed contract
   *
   * @param program
   * @param abiData
   * @param contractStorageAccount
   * @returns
   */
  async getContract(
    abiData: string,
    contractStorageAccount: Keypair
  ): Promise<Contract> {
    return Contract.get(this, abiData, contractStorageAccount);
  }
}
