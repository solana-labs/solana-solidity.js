import {
  Keypair,
  PublicKey,
  Connection,
  BpfLoader,
  BPF_LOADER_PROGRAM_ID,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  TransactionInstruction,
  ConfirmOptions,
} from '@solana/web3.js';
import crypto from 'crypto';
import { Interface } from '@ethersproject/abi';
import { ContractDeployResult } from 'src';

import { Contract, ContractDeployOptions } from './contract';
import {
  LogsParser,
  LogCallback,
  EventCallback,
  parseTxError,
  parseTxLogs,
} from './logs';

export class Program {
  public connection: Connection;
  public payerAccount: Keypair;
  public programAccount: Keypair;
  protected logs: LogsParser;

  /**
   *
   * Load a Solang program
   *
   * @param connection      Solana connection
   * @param payerAccount    Payer pubkey
   * @param programAccount  The program's pubkey
   * @param so              Solang program build bundle
   * @returns               The program
   */
  static async load(
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
   * Create an instance representing a Solang program
   *
   * @param connection      Solana connection
   * @param payerAccount    Payer pubkey
   * @param programAccount  The program's pubkey
   */
  constructor(
    _connection: Connection,
    _payerAccount: Keypair,
    _programAccount: Keypair
  ) {
    this.connection = _connection;
    this.payerAccount = _payerAccount;
    this.programAccount = _programAccount;
    this.logs = new LogsParser(this.programAccount.publicKey, this.connection);
  }

  /**
   * Create program address
   *
   * @param salt
   * @returns
   */
  async createProgramAddress(): Promise<{
    account: PublicKey;
    seed: Buffer;
  } | null> {
    while (true) {
      const seed = crypto.randomBytes(7);

      let account: PublicKey | null = null;
      try {
        account = await PublicKey.createProgramAddress(
          [seed],
          this.programAccount.publicKey
        );
      } catch {}

      if (account) {
        return { account, seed };
      }
    }
  }

  /**
   * Create a storage account
   *
   * @param space
   * @returns
   */
  public async createStorageAccount(
    account: Keypair,
    space: number,
    confirmOptions?: ConfirmOptions
  ): Promise<Keypair> {
    const lamports = await this.connection.getMinimumBalanceForRentExemption(
      space
    );

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
      confirmOptions ?? {
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
   * @param callback  The function to invoke whenever a `Program log:` is parsed in the logs.
   */
  public addLogListener(callback: LogCallback): number {
    return this.logs.addLogListener(callback);
  }

  /**
   * Unsubscribes from the given log listener id.
   *
   * @param listenerId The log listener id
   */
  public async removeLogListener(listenerId: number): Promise<void> {
    return await this.logs.removeLogListener(listenerId);
  }

  /**
   * Invokes the given callback every time the given event is emitted.
   *
   * @param abi       ABI interface
   * @param callback  The function to invoke whenever the event is emitted from
   *                  program logs.
   */
  public addEventListener(abi: Interface, callback: EventCallback): number {
    return this.logs.addEventListener(abi, callback);
  }

  /**
   * Unsubscribes from the given eventName.
   *
   * @param listenerId The log listener id
   */
  public async removeEventListener(listenerId: number): Promise<void> {
    return await this.logs.removeEventListener(listenerId);
  }

  /**
   * Deploy a new contract in a loaded Solang program
   *
   * @param program
   * @param options
   * @returns
   */
  public async deployContract(
    options: ContractDeployOptions
  ): Promise<ContractDeployResult> {
    return Contract.deploy(this, options);
  }

  /**
   * Load a deployed contract
   *
   * @param program
   * @param abiData
   * @param contractStorageAccount
   * @returns                      The contract instance
   */
  public async getContract(
    abiData: string,
    contractStorageAccount: PublicKey
  ): Promise<Contract> {
    return Contract.get(this, abiData, contractStorageAccount);
  }

  /**
   * Make and execute a transaction with the given `instructions` and `signers`
   *
   * @param instructions  Solana instructions
   * @param signers       List of signers
   * @returns             Transaction result
   */
  public async sendAndConfirmTransaction(
    instructions: TransactionInstruction[],
    signers: Keypair[],
    confirmOptions?: ConfirmOptions
  ): Promise<{
    encoded: Buffer | null;
    logs: string[];
    computeUnitsUsed: number;
  }> {
    const transaction = new Transaction().add(...instructions);

    let sig;
    try {
      sig = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        signers,
        confirmOptions ?? {
          skipPreflight: false,
          commitment: 'confirmed',
          preflightCommitment: undefined,
        }
      );
    } catch (e) {
      const simulateTxResult = await this.connection.simulateTransaction(
        transaction,
        signers
      );
      const logs = simulateTxResult.value.logs ?? [];

      if (!simulateTxResult.value.err) {
        throw new Error('error is not falsy');
      }

      const parseTxLogsResult = parseTxLogs(logs);
      throw parseTxError(
        parseTxLogsResult.encoded,
        parseTxLogsResult.computeUnitsUsed,
        parseTxLogsResult.log,
        logs
      );
    }

    const parsedTx = await this.connection.getParsedConfirmedTransaction(sig);
    const logs = parsedTx!.meta?.logMessages ?? [];
    const parseTxLogsResult = parseTxLogs(logs);
    const encoded = parseTxLogsResult.encoded;
    const computeUnitsUsed = parseTxLogsResult.computeUnitsUsed;

    return { encoded, logs, computeUnitsUsed };
  }

  /**
   * Simulate a transaction containing the given `instructions` and `signers`
   *
   * @param instructions  Solana instructions
   * @param signers       List of signers
   * @returns             Transaction result
   */
  public async simulateTransaction(
    instructions: TransactionInstruction[],
    signers: Keypair[]
  ): Promise<{
    encoded: Buffer | null;
    logs: string[];
    computeUnitsUsed: number;
  }> {
    const transaction = new Transaction().add(...instructions);

    const simulateTxResult = await this.connection.simulateTransaction(
      transaction,
      signers
    );
    const logs = simulateTxResult.value.logs ?? [];
    const parseTxLogsResult = parseTxLogs(logs);
    const encoded = parseTxLogsResult.encoded;
    const computeUnitsUsed = parseTxLogsResult.computeUnitsUsed;

    if (simulateTxResult.value.err) {
      throw parseTxError(
        encoded,
        computeUnitsUsed,
        parseTxLogsResult.log,
        logs
      );
    }

    return { encoded, logs, computeUnitsUsed };
  }
}
