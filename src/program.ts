import {
  Keypair,
  Connection,
  BpfLoader,
  BPF_LOADER_PROGRAM_ID,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { ethers } from 'ethers';
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
  private logs: LogsParser;

  /**
   * Load a new Solang program
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
   * Load a deployed Solang program
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
    this.logs = new LogsParser(this.programAccount.publicKey, this.connection);
  }

  /**
   * Create a storage account
   *
   * @param space
   * @returns
   */
  public async createStorageAccount(space: number): Promise<Keypair> {
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
  public addEventListener(
    abi: ethers.utils.Interface,
    callback: EventCallback
  ): number {
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
    contractStorageAccount: Keypair
  ): Promise<Contract> {
    return Contract.get(this, abiData, contractStorageAccount);
  }

  /**
   * Make and execute a transaction with the given `instruction` and `signers`
   *
   * @param simulate     Whether to perform a dry-run
   * @param instruction  Solana instruction
   * @param signers      List of signers
   * @returns            Transaction result
   */
  public async makeTx(
    simulate: Boolean,
    instruction: TransactionInstruction,
    signers: Keypair[]
  ): Promise<{
    encoded: string | null;
    logs: string[];
    computeUnitsUsed: number;
  }> {
    let encoded;
    let logs: string[] = [];
    let computeUnitsUsed = 0;

    if (simulate) {
      const simulateTxResult = await this.connection.simulateTransaction(
        new Transaction().add(instruction),
        signers
      );

      logs = simulateTxResult.value.logs ?? [];
      // console.log(logs);

      const parseTxLogsResult = parseTxLogs(logs);
      encoded = parseTxLogsResult.encoded;
      computeUnitsUsed = parseTxLogsResult.computeUnitsUsed;

      if (simulateTxResult.value.err) {
        throw parseTxError(
          encoded,
          computeUnitsUsed,
          parseTxLogsResult.log,
          logs
        );
      }
    } else {
      let sig;
      try {
        sig = await sendAndConfirmTransaction(
          this.connection,
          new Transaction().add(instruction),
          signers,
          {
            skipPreflight: false,
            commitment: 'confirmed',
            preflightCommitment: undefined,
          }
        );
      } catch {
        const simulateTxResult = await this.connection.simulateTransaction(
          new Transaction().add(instruction),
          signers
        );
        logs = simulateTxResult.value.logs ?? [];
        // console.log(logs);

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
      logs = parsedTx!.meta?.logMessages ?? [];
      // console.log(logs);

      const parseTxLogsResult = parseTxLogs(logs);
      encoded = parseTxLogsResult.encoded;
      computeUnitsUsed = parseTxLogsResult.computeUnitsUsed;
    }

    return { encoded, logs, computeUnitsUsed };
  }
}
