import { Fragment, Interface, LogDescription, Result } from '@ethersproject/abi';
import { keccak256 } from '@ethersproject/keccak256';
import {
    BPF_LOADER_PROGRAM_ID,
    BpfLoader,
    ConfirmOptions,
    Connection,
    PublicKey,
    sendAndConfirmTransaction,
    Signer,
    SystemProgram,
    SYSVAR_CLOCK_PUBKEY,
    Transaction,
    TransactionInstruction,
} from '@solana/web3.js';
import {
    EventListener,
    LogListener,
    LogsParser,
    parseLogTopic,
    sendAndConfirmTransactionWithLogs,
    simulateTransactionWithLogs,
} from './logs';
import { Abi, encodeSeeds, numToPaddedHex } from './utils';

// @FIXME: hack to keep existing tests passing because they assume `result` cannot be null
// @FIXME: this should return Promise<ContractFunctionResult> and tests should be refactored
// @TODO: docs
export type ContractFunction = (...args: any[]) => Promise<any>;

// @TODO: docs
export interface ProgramDerivedAddress {
    account: PublicKey;
    seed: Buffer;
}

// @TODO: docs
export interface ContractCallOptions {
    payer?: Signer;
    accounts?: PublicKey[];
    writableAccounts?: PublicKey[];
    programDerivedAddresses?: ProgramDerivedAddress[];
    signers?: Signer[];
    sender?: PublicKey | undefined;
    value?: number;
    simulate?: boolean;
    confirmOptions?: ConfirmOptions;
}

// @TODO: docs
export interface ContractCallResult {
    logs: string[];
    events: LogDescription[];
    computeUnitsUsed: number;
}

// @TODO: docs
export interface ContractFunctionResult extends ContractCallResult {
    result: Result | null;
}

// @TODO: docs
export type ContractCreateStorageOptions = Pick<ContractCallOptions, 'payer' | 'confirmOptions'>;

/** A contract represents a Solidity contract that has been compiled with Solang to be deployed on Solana. */
export class Contract {
    /** Connection to use */
    readonly connection: Connection;
    /** Account the program is located at (aka Program ID) */
    readonly program: PublicKey;
    /** Account the program's data is stored at */
    readonly storage: PublicKey;
    /** Application Binary Interface in JSON form */
    readonly abi: Abi;
    /** Ethers.js interface parsed from the ABI */
    readonly interface: Interface;
    /** Callable functions mapped to the interface */
    readonly functions: Record<string, ContractFunction>;
    /** Parser for events and program logs */
    readonly logs: LogsParser;
    /** Payer for transactions and storage (optional) */
    payer: Signer | null;

    /*
     * Create a contract. It can either be a new contract to deploy as a Solana program,
     * or a reference to one already deployed.
     *
     * @param connection Connection to use
     * @param program    Account the program is located at (aka Program ID)
     * @param storage    Account the program's data is stored at
     * @param abi        Application Binary Interface in JSON form
     * @param payer      Payer for transactions and storage (optional)
     */
    constructor(connection: Connection, program: PublicKey, storage: PublicKey, abi: Abi, payer: Signer | null = null) {
        this.connection = connection;
        this.program = program;
        this.storage = storage;
        this.abi = abi;
        this.interface = new Interface(abi);
        this.functions = {};
        for (const fragment of Object.values(this.interface.functions)) {
            this.functions[fragment.name] = this.buildCall(fragment);
        }
        this.payer = payer;
        this.logs = new LogsParser(this);
    }

    /**
     * Clone the contract. This creates a new contract with the same configuration but no log listeners.
     *
     * @return Clone of the contract
     */
    clone(): Contract {
        return new Contract(this.connection, this.program, this.storage, this.abi, this.payer);
    }

    /**
     * Set the payer for transactions and storage
     *
     * @param payer Payer for transactions and storage (or `null` to unset)
     *
     * @return Contract itself (for method chaining)
     */
    connect(payer: Signer | null): this {
        this.payer = payer;
        return this;
    }

    /**
     * Load the contract's BPF bytecode as a Solana program.
     *
     * @param program Keypair for the account the program is located at
     * @param so      ELF .so file produced by compiling the contract with Solang
     * @param payer   Payer for transactions and storage (defaults to the payer provided in the constructor)
     */
    async load(program: Signer, so: Buffer, payer?: Signer | null): Promise<void> {
        if (!program.publicKey.equals(this.program)) throw new Error('INVALID_PROGRAM_ACCOUNT'); // @FIXME: add error types

        payer ||= this.payer;
        if (!payer) throw new Error('MISSING_PAYER_ACCOUNT'); // @FIXME: add error types

        // @TODO: error if the program already exists without sending a transaction

        await BpfLoader.load(this.connection, payer, program, so, BPF_LOADER_PROGRAM_ID);
    }

    /**
     * Deploy the contract to a loaded Solana program.
     *
     * @param name            Name of the contract to deploy
     * @param constructorArgs Arguments to pass to the contract's Solidity constructor function
     * @param program         Keypair for the account the program is located at
     * @param storage         Keypair for the account the program's data is stored at
     * @param space           Byte size to allocate for the storage account (this cannot be resized)
     * @param options         @TODO: docs
     *
     * @return @TODO: docs
     */
    async deploy(
        name: string,
        constructorArgs: any[],
        program: Signer,
        storage: Signer,
        space: number,
        options?: ContractCallOptions
    ): Promise<ContractCallResult> {
        if (!program.publicKey.equals(this.program)) throw new Error('INVALID_PROGRAM_ACCOUNT'); // @FIXME: add error types
        if (!storage.publicKey.equals(this.storage)) throw new Error('INVALID_STORAGE_ACCOUNT'); // @FIXME: add error types

        const payer = options?.payer || this.payer;
        if (!payer) throw new Error('MISSING_PAYER_ACCOUNT'); // @FIXME: add error types

        const {
            accounts = [],
            writableAccounts = [],
            programDerivedAddresses = [],
            signers = [],
            sender = payer.publicKey,
            value = 0,
            simulate = false,
            confirmOptions = {
                commitment: 'confirmed',
                skipPreflight: false,
                preflightCommitment: 'processed',
            },
        } = options ?? {};

        // @TODO: error if the contract has already been deployed without sending a transaction

        await this.createStorage(storage, space, { payer, confirmOptions });

        const hash = keccak256(Buffer.from(name));
        const seeds = programDerivedAddresses.map((pda) => pda.seed);
        const input = this.interface.encodeDeploy(constructorArgs);

        const data = Buffer.concat([
            this.storage.toBuffer(), //                     storage @FIXME: these comments are kind of useless
            sender.toBuffer(), //                           sender  @FIXME: better to explain why, not what
            Buffer.from(numToPaddedHex(value), 'hex'), //   value
            Buffer.from(hash.substr(2, 8), 'hex'), //       hash
            encodeSeeds(seeds), //                          seeds
            Buffer.from(input.replace('0x', ''), 'hex'), // input
        ]);

        // @FIXME: why are so many of these keys commented out?
        const keys = [
            // @FIXME: should all these PDAs really be writable?
            // ...programDerivedAddresses.map((pubkey) => ({
            //   pubkey,
            //   isSigner: false,
            //   isWritable: true,
            // })),
            {
                pubkey: storage.publicKey,
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

        const transaction = new Transaction().add(
            new TransactionInstruction({
                keys,
                programId: this.program,
                data,
            })
        );

        const { logs, computeUnitsUsed } = simulate
            ? await simulateTransactionWithLogs(this.connection, transaction, [payer, ...signers])
            : await sendAndConfirmTransactionWithLogs(this.connection, transaction, [payer, ...signers]);

        const events = this.parseLogsEvents(logs);

        return {
            logs,
            events,
            computeUnitsUsed,
        };
    }

    /**
     * Create a storage account for the contract, or for a child contract
     *
     * @param storage Keypair for the account the program's data is stored at
     * @param space   Byte size to allocate for the storage account (this cannot be resized)
     * @param options @TODO: docs
     */
    async createStorage(storage: Signer, space: number, options?: ContractCreateStorageOptions): Promise<void> {
        const payer = options?.payer || this.payer;
        if (!payer) throw new Error('MISSING_PAYER_ACCOUNT'); // @FIXME: add error types

        const {
            confirmOptions = {
                commitment: 'confirmed',
                skipPreflight: false,
                preflightCommitment: 'processed',
            },
        } = options ?? {};

        // @TODO: error if the storage has already been created without sending a transaction

        const lamports = await this.connection.getMinimumBalanceForRentExemption(space, confirmOptions.commitment);

        const transaction = new Transaction().add(
            SystemProgram.createAccount({
                fromPubkey: payer.publicKey,
                newAccountPubkey: storage.publicKey,
                lamports,
                space,
                programId: this.program,
            })
        );

        await sendAndConfirmTransaction(this.connection, transaction, [payer, storage], confirmOptions);
    }

    /**
     * Add a listener for log messages
     *
     * @param listener Callback for log messages
     *
     * @return ID of the listener (pass to `removeLogListener` to stop listening)
     */
    addLogListener(listener: LogListener): number {
        return this.logs.addLogListener(listener);
    }

    /**
     * Remove a listener for log messages
     *
     * @param listenerId ID of the listener (returned by `addLogListener`)
     */
    async removeLogListener(listenerId: number): Promise<void> {
        return await this.logs.removeLogListener(listenerId);
    }

    /**
     * Add a listener for contract events
     *
     * @param listener Callback for contract events
     *
     * @return ID of the listener (pass to `removeEventListener` to stop listening)
     */
    addEventListener(listener: EventListener): number {
        return this.logs.addEventListener(listener);
    }

    /**
     * Remove a listener for contract events
     *
     * @param listenerId ID of the listener (returned by `addEventListener`)
     */
    async removeEventListener(listenerId: number): Promise<void> {
        return await this.logs.removeEventListener(listenerId);
    }

    /** @internal */
    protected parseLogsEvents(logs: string[]): LogDescription[] {
        const events: LogDescription[] = [];

        for (const log of logs) {
            const eventData = parseLogTopic(log);
            if (eventData) {
                const event = this.interface.parseLog(eventData);
                events.push(event);
            }
        }

        return events;
    }

    /** @internal */
    protected buildCall(fragment: Fragment): ContractFunction {
        return (...args: any[]) => {
            const options = args[args.length - 1];
            if (args.length > fragment.inputs.length && typeof options === 'object') {
                return this.call(fragment.name, args.slice(0, fragment.inputs.length), options);
            } else {
                return this.call(fragment.name, args);
            }
        };
    }

    /** @internal */
    protected async call(name: string, args: any[], options?: ContractCallOptions): Promise<ContractFunctionResult> {
        const payer = options?.payer || this.payer;
        if (!payer) throw new Error('MISSING_PAYER_ACCOUNT'); // @FIXME: add error types

        const {
            accounts = [],
            writableAccounts = [],
            programDerivedAddresses = [],
            signers = [],
            sender = payer.publicKey,
            value = 0,
            simulate = false,
            confirmOptions = {
                commitment: 'confirmed',
                skipPreflight: false,
                preflightCommitment: 'processed',
            },
        } = options ?? {};

        const seeds = programDerivedAddresses.map(({ seed }) => seed);
        const input = this.interface.encodeFunctionData(name, args);

        const data = Buffer.concat([
            this.storage.toBuffer(), //                       storage  @FIXME: these comments are kind of useless
            sender.toBuffer(), //                             sender   @FIXME: better to explain why, not what
            Buffer.from(numToPaddedHex(value), 'hex'), //     value
            Buffer.from('00000000', 'hex'), //                hash
            encodeSeeds(seeds), //                            seeds
            Buffer.from(input.replace('0x', ''), 'hex'), //   input
        ]);

        const keys = [
            // @FIXME: should all these PDAs really be writable?
            ...programDerivedAddresses.map((pda) => ({
                pubkey: pda.account,
                isSigner: false,
                isWritable: true,
            })),
            {
                pubkey: this.storage,
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

        const transaction = new Transaction().add(
            new TransactionInstruction({
                keys,
                programId: this.program,
                data,
            })
        );

        const { logs, encoded, computeUnitsUsed } = simulate
            ? await simulateTransactionWithLogs(this.connection, transaction, [payer, ...signers])
            : await sendAndConfirmTransactionWithLogs(
                  this.connection,
                  transaction,
                  [payer, ...signers],
                  confirmOptions
              );

        const events = this.parseLogsEvents(logs);

        let result: Result | null = null;

        const fragment = this.interface.getFunction(name);
        if (fragment.outputs?.length) {
            if (!encoded) throw new Error('MISSING_RETURN_DATA'); // @FIXME: add error types

            result = this.interface.decodeFunctionResult(fragment, encoded);
            if (fragment.outputs.length === 1) {
                result = result[0];
            }
        }

        return { result, logs, events, computeUnitsUsed };
    }
}
