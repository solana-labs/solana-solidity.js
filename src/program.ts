import {
  Keypair,
  Connection,
  BpfLoader,
  BPF_LOADER_PROGRAM_ID,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';

import { EventManager } from './events';

export class Program {
  public events: EventManager;

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

  constructor(
    public connection: Connection,
    public payerAccount: Keypair,
    public programAccount: Keypair
  ) {
    this.events = new EventManager(
      this.programAccount.publicKey,
      this.connection
    );
  }

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
        commitment: 'recent',
        preflightCommitment: undefined,
      }
    );

    console.log('contract storage account', account.publicKey.toBase58());

    return account;
  }
}
