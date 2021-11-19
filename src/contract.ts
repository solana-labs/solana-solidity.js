import { FunctionFragment, Interface, LogDescription, Result } from '@ethersproject/abi';
import { keccak256 } from '@ethersproject/keccak256';
import { defineReadOnly } from '@ethersproject/properties';
import {
    BPF_LOADER_PROGRAM_ID,
    BpfLoader,
    ConfirmOptions,
    Connection,
    PublicKey,
    Signer,
    SystemProgram,
    SYSVAR_CLOCK_PUBKEY,
    Transaction,
    TransactionInstruction,
} from '@solana/web3.js';
import {
    InvalidProgramAccountError,
    InvalidStorageAccountError,
    MissingPayerAccountError,
    MissingReturnDataError,
} from './errors';
import { LogsParser, parseLogTopic, sendAndConfirmTransactionWithLogs, simulateTransactionWithLogs } from './logs';
import { ABI, encodeSeeds, ProgramDerivedAddress } from './utils';

/** Accounts, signers, and other parameters for calling a contract function or constructor */
export interface ContractCallOptions {
    payer?: Signer;
    accounts?: PublicKey[];
    writableAccounts?: PublicKey[];
    programDerivedAddresses?: ProgramDerivedAddress[];
    signers?: Signer[];
    sender?: PublicKey | undefined;
    value?: number | bigint;
    simulate?: boolean;
    confirmOptions?: ConfirmOptions;
}

/** Result of a contract function or constructor call */
export interface ContractCallResult {
    logs: string[];
    events: LogDescription[];
    computeUnitsUsed: number;
}

/** Result of a contract function call */
export interface ContractFunctionResult extends ContractCallResult {
    result: Result | null;
}

/** Function that maps to a function declared in the contract ABI */
export type ContractFunction = (...args: any[]) => Promise<ContractFunctionResult | any>;

/** Callback function that will be called with decoded events */
export type EventListener = (event: LogDescription) => void;

/** Callback function that will be called with raw log messages */
export type LogListener = (message: string) => void;

/** A contract represents a Solidity contract that has been compiled with Solang to be deployed on Solana. */
export class Contract {
    /** Functions that map to the functions declared in the contract ABI */
    readonly [name: string]: ContractFunction | any;

    /** Connection to use */
    readonly connection: Connection;
    /** Account the program is located at (aka Program ID) */
    readonly program: PublicKey;
    /** Account the program's data is stored at */
    readonly storage: PublicKey;
    /** Application Binary Interface in JSON form */
    readonly abi: ABI;
    /** Ethers.js interface parsed from the ABI */
    readonly interface: Interface;
    /** Callable functions mapped to the interface */
    readonly functions: Record<string, ContractFunction>;
    /** Payer for transactions and storage (optional) */
    payer: Signer | null;

    /** @internal */
    protected readonly logs: LogsParser;

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
    constructor(connection: Connection, program: PublicKey, storage: PublicKey, abi: ABI, payer: Signer | null = null) {
        this.connection = connection;
        this.program = program;
        this.storage = storage;
        this.abi = abi;
        this.interface = new Interface(abi);
        this.functions = {};
        this.payer = payer;
        this.logs = new LogsParser(this);

        const uniqueNames: Record<string, string[]> = {};
        const uniqueSignatures: Record<string, boolean> = {};

        for (const [signature, fragment] of Object.entries(this.interface.functions)) {
            if (uniqueSignatures[signature]) {
                console.warn(`Duplicate ABI entry for ${JSON.stringify(signature)}`);
                return;
            }
            uniqueSignatures[signature] = true;

            const name = fragment.name;
            if (!uniqueNames[`%${name}`]) {
                uniqueNames[`%${name}`] = [];
            }
            uniqueNames[`%${name}`].push(signature);

            if (!this.functions[signature]) {
                defineReadOnly(this.functions, signature, this.buildCall(fragment, false));
            }
            if (typeof this[signature] === 'undefined') {
                defineReadOnly<any, any>(this, signature, this.buildCall(fragment, true));
            }
        }

        for (const uniqueName of Object.keys(uniqueNames)) {
            const signatures = uniqueNames[uniqueName];
            if (signatures.length > 1) continue;
            const signature = signatures[0];

            const name = uniqueName.slice(1);
            if (!this.functions[name]) {
                defineReadOnly(this.functions, name, this.functions[signature]);
            }
            if (typeof this[name] === 'undefined') {
                defineReadOnly(this, name, this[signature]);
            }
        }
    }

    /**
     * Load the contract's BPF bytecode as a Solana program.
     *
     * @param program Keypair for the account the program is located at
     * @param so      ELF .so file produced by compiling the contract with Solang
     * @param payer   Payer for transactions and storage (defaults to the payer provided in the constructor)
     */
    async load(program: Signer, so: Buffer, payer?: Signer | null): Promise<void> {
        if (!program.publicKey.equals(this.program)) throw new InvalidProgramAccountError();

        payer ||= this.payer;
        if (!payer) throw new MissingPayerAccountError();

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
     * @param options         Accounts, signers, and other parameters for calling the contract constructor
     *
     * @return Result of the contract constructor call
     */
    async deploy(
        name: string,
        constructorArgs: any[],
        program: Signer,
        storage: Signer,
        space: number,
        options?: ContractCallOptions
    ): Promise<ContractCallResult> {
        if (!program.publicKey.equals(this.program)) throw new InvalidProgramAccountError();
        if (!storage.publicKey.equals(this.storage)) throw new InvalidStorageAccountError();

        const payer = options?.payer || this.payer;
        if (!payer) throw new MissingPayerAccountError();

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

        const hash = keccak256(Buffer.from(name));
        const seeds = programDerivedAddresses.map(({ seed }) => seed);
        const input = this.interface.encodeDeploy(constructorArgs);

        const data = Buffer.concat([
            // storage account where state for this contract will be stored
            this.storage.toBuffer(),
            // msg.sender for this transaction
            sender.toBuffer(),
            // lamports to send to payable constructor
            encodeU64(BigInt(value)),
            // hash of contract name
            Buffer.from(hash.substr(2, 8), 'hex'),
            // PDA seeds
            encodeSeeds(seeds),
            // eth abi encoded constructor arguments
            Buffer.from(input.replace('0x', ''), 'hex'),
        ]);

        const keys = [
            ...programDerivedAddresses.map(({ address }) => ({
                pubkey: address,
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

        const lamports = await this.connection.getMinimumBalanceForRentExemption(space, confirmOptions.commitment);

        const transaction = new Transaction().add(
            SystemProgram.createAccount({
                fromPubkey: payer.publicKey,
                newAccountPubkey: storage.publicKey,
                lamports,
                space,
                programId: this.program,
            }),
            new TransactionInstruction({
                keys,
                programId: this.program,
                data,
            })
        );

        const { logs, computeUnitsUsed } = simulate
            ? await simulateTransactionWithLogs(this.connection, transaction, [payer, storage, ...signers])
            : await sendAndConfirmTransactionWithLogs(this.connection, transaction, [payer, storage, ...signers]);

        const events = this.parseLogsEvents(logs);

        return {
            logs,
            events,
            computeUnitsUsed,
        };
    }

    /**
     * Set the payer for transactions and storage
     *
     * @param payer Payer for transactions and storage
     *
     * @return Contract itself (for method chaining)
     */
    connect(payer: Signer): this {
        this.payer = payer;
        return this;
    }

    /**
     * Unset the payer for transactions and storage
     *
     * @return Contract itself (for method chaining)
     */
    disconnect(): this {
        this.payer = null;
        return this;
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
    protected buildCall(fragment: FunctionFragment, returnResult: boolean): ContractFunction {
        return (...args: any[]) => {
            const options = args[args.length - 1];
            if (args.length > fragment.inputs.length && typeof options === 'object') {
                return this.call(fragment, returnResult, args.slice(0, fragment.inputs.length), options);
            } else {
                return this.call(fragment, returnResult, args);
            }
        };
    }

    /** @internal */
    protected async call<T extends boolean>(
        fragment: FunctionFragment,
        returnResult: T,
        args: readonly any[],
        options?: ContractCallOptions
    ): Promise<T extends true ? any : ContractFunctionResult> {
        const payer = options?.payer || this.payer;
        if (!payer) throw new MissingPayerAccountError();

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
        const input = this.interface.encodeFunctionData(fragment, args);

        const data = Buffer.concat([
            // storage account where state for this contract will be stored
            this.storage.toBuffer(),
            // msg.sender for this transaction
            sender.toBuffer(),
            // lamports to send to payable constructor
            encodeU64(BigInt(value)),
            // hash of contract name, 0 for function calls
            Buffer.from('00000000', 'hex'),
            // PDA seeds
            encodeSeeds(seeds),
            // eth abi encoded constructor arguments
            Buffer.from(input.replace('0x', ''), 'hex'),
        ]);

        const keys = [
            ...programDerivedAddresses.map(({ address }) => ({
                pubkey: address,
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

        // If the function is read-only, simulate the transaction to get the result
        const { logs, encoded, computeUnitsUsed } =
            simulate || fragment.stateMutability === 'view' || fragment.stateMutability === 'pure'
                ? await simulateTransactionWithLogs(this.connection, transaction, [payer, ...signers])
                : await sendAndConfirmTransactionWithLogs(
                    this.connection,
                    transaction,
                    [payer, ...signers],
                    confirmOptions
                );

        const events = this.parseLogsEvents(logs);

        const length = fragment.outputs?.length;
        let result: Result | null = null;

        if (length) {
            if (!encoded) throw new MissingReturnDataError();

            if (length == 1) {
                [result] = this.interface.decodeFunctionResult(fragment, encoded);
            } else {
                result = this.interface.decodeFunctionResult(fragment, encoded);
            }
        }

        if (returnResult === true)
            return result as any;
        return { result, logs, events, computeUnitsUsed };
    }
}

function encodeU64(num: bigint): Buffer {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64LE(num, 0);
    return buf;
}
