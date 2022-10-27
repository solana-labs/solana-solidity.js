import { LogDescription, ParamType } from '@ethersproject/abi';
import {
    ConfirmOptions,
    SendTransactionError,
    Connection,
    Finality,
    sendAndConfirmTransaction,
    Signer,
    Transaction,
} from '@solana/web3.js';
import { Contract, EventListener, LogListener } from './contract';
import { TransactionError } from './errors';
import { borshDecode } from './borsh';

const LOG_RETURN_PREFIX = 'Program return: ';
const LOG_LOG_PREFIX = 'Program log: ';
const LOG_COMPUTE_UNITS_REGEX = /consumed (\d+) of (\d+) compute units/i;
const LOG_DATA_PREFIX = 'Program data: ';
const LOG_FAILED_TO_COMPLETE_PREFIX = 'Program failed to complete: ';
const LOG_FAILED_REGEX = /(Program \w+ )?failed: (.*)$/;

/** @internal */
export class LogsParser {
    protected _contract: Contract;
    protected _eventListeners: Map<number, EventListener>;
    protected _logListeners: Map<number, LogListener>;
    protected _listenerId: number;
    protected _subscriptionId: number | undefined;

    constructor(contract: Contract) {
        this._contract = contract;
        this._eventListeners = new Map();
        this._logListeners = new Map();
        this._listenerId = 0;
    }

    public addEventListener(listener: EventListener): number {
        const listenerId = ++this._listenerId;
        this._eventListeners.set(listenerId, listener);

        this.setupSubscription();

        return listenerId;
    }

    public async removeEventListener(listenerId: number): Promise<void> {
        this._eventListeners.delete(listenerId);
        await this.teardownSubscription();
    }

    public addLogListener(listener: LogListener): number {
        const listenerId = ++this._listenerId;
        this._logListeners.set(listenerId, listener);

        this.setupSubscription();

        return listenerId;
    }

    public async removeLogListener(listenerId: number): Promise<void> {
        this._logListeners.delete(listenerId);
        await this.teardownSubscription();
    }

    protected setupSubscription(): void {
        this._subscriptionId ||= this._contract.connection.onLogs(this._contract.program, (logs) => {
            if (logs.err) return;
            for (const log of logs.logs) {
                const eventData = parseLogTopic(log);
                const message = parseLogLog(log);

                if (eventData) {
                    for (const listener of this._eventListeners.values()) {
                        let event: LogDescription | null = null;
                        try {
                            event = this._contract.interface.parseLog(eventData);
                        } catch (error) {
                            console.error(error);
                        }
                        if (event) {
                            listener(event);
                        }
                    }
                }

                if (message) {
                    for (const listener of this._logListeners.values()) {
                        listener(message);
                    }
                }
            }
        });
    }

    protected async teardownSubscription(): Promise<void> {
        if (this._subscriptionId !== undefined && this._eventListeners.size == 0 && this._logListeners.size == 0) {
            await this._contract.connection.removeOnLogsListener(this._subscriptionId);
            this._subscriptionId = undefined;
        }
    }
}

/** @internal */
export interface LogsResult {
    logs: string[];
    encoded: Buffer | null;
    computeUnitsUsed: number;
    signature: string | null;
}

/** @internal */
export async function simulateTransactionWithLogs(
    connection: Connection,
    transaction: Transaction,
    signers?: Signer[]
): Promise<LogsResult> {
    const result = await connection.simulateTransaction(transaction, signers);

    const logs = result.value.logs ?? [];
    const { log, encoded, computeUnitsUsed } = parseTransactionLogs(logs);

    if (result.value.err) throw parseTransactionError(encoded, computeUnitsUsed, log, logs, null);

    return { logs, encoded, computeUnitsUsed, signature: null };
}

/** @internal */
export async function sendAndConfirmTransactionWithLogs(
    connection: Connection,
    transaction: Transaction,
    signers: Signer[],
    confirmOptions?: ConfirmOptions,
    finality?: Finality
): Promise<LogsResult> {
    confirmOptions = {
        commitment: 'confirmed',
        skipPreflight: false,
        preflightCommitment: 'processed',
        ...confirmOptions,
    };

    try {
        const signature = await sendAndConfirmTransaction(connection, transaction, signers, confirmOptions);
        const parsed = await connection.getParsedConfirmedTransaction(signature, finality);

        const logs = parsed?.meta?.logMessages ?? [];
        const { encoded, computeUnitsUsed } = parseTransactionLogs(logs);

        return { logs, encoded, computeUnitsUsed, signature };
    } catch (error) {
        if (error instanceof SendTransactionError) {
            if (error.logs && error.logs.length != 0) {
                const { encoded, computeUnitsUsed } = parseTransactionLogs(error.logs);

                throw parseTransactionError(encoded, computeUnitsUsed, null, error.logs, error.message);
            }
        }

        throw error;
    }
}

/** @internal */
export function parseTransactionLogs(logs: string[]): {
    encoded: Buffer | null;
    computeUnitsUsed: number;
    log: string | null;
} {
    let encoded: Buffer | null = null;
    let computeUnitsUsed = 0;
    let log: string | null = null;

    for (const message of logs) {
        const _encoded = parseLogReturn(message);
        if (_encoded) encoded = _encoded;

        let _log = parseLogFailedToComplete(message);
        if (_log) log = _log;

        _log = parseLogLog(message);
        if (_log) log = _log;

        const _computeUnitsUsed = parseLogComputeUnitsUsed(message);
        if (_computeUnitsUsed) computeUnitsUsed = _computeUnitsUsed;
    }

    return { encoded, computeUnitsUsed, log };
}

/** @internal */
export function parseTransactionError(
    encoded: Buffer | null,
    computeUnitsUsed: number,
    log: string | null,
    logs: string[],
    message: string | null
): TransactionError {
    let error: TransactionError;

    if (log) {
        error = new TransactionError(log);
    } else if (!encoded) {
        const failedMatch = logs[logs.length - 1].match(LOG_FAILED_REGEX);
        error = failedMatch
            ? new TransactionError(failedMatch[2])
            : message
            ? new TransactionError(message)
            : new TransactionError('return data or log not set');
    } else if (encoded.readUInt32LE(0) != 0x08c379a0) {
        error = new TransactionError('signature not correct');
    } else {
        const params = [ParamType.from('uint32'), ParamType.fromString('string')];
        const revertReason = borshDecode(params, encoded);
        error = new TransactionError(revertReason[1]);
    }

    error.logs = logs;
    error.computeUnitsUsed = computeUnitsUsed;

    return error;
}

/** @internal */
export interface EventData {
    data: string;
    topics: string[];
}

/** @internal */
export function parseLogTopic(log: string): EventData | null {
    if (log.startsWith(LOG_DATA_PREFIX)) {
        const fields = log.slice(LOG_DATA_PREFIX.length).split(' ');
        if (fields.length == 2) {
            const topicData = Buffer.from(fields[0], 'base64');
            const topics: string[] = [];
            for (let offset = 0; offset < topicData.length; offset += 32) {
                topics.push('0x' + topicData.subarray(offset, offset + 32).toString('hex'));
            }
            const data = '0x' + Buffer.from(fields[1], 'base64').toString('hex');
            return { data, topics };
        }
    }
    return null;
}

/** @internal */
export function parseLogReturn(log: string): Buffer | null {
    if (log.startsWith(LOG_RETURN_PREFIX)) {
        const [, returnData] = log.slice(LOG_RETURN_PREFIX.length).split(' ');
        return Buffer.from(returnData, 'base64');
    }
    return null;
}

/** @internal */
export function parseLogLog(log: string): string | null {
    if (log.startsWith(LOG_LOG_PREFIX)) return log.slice(LOG_LOG_PREFIX.length);
    return null;
}

/** @internal */
export function parseLogComputeUnitsUsed(log: string): number | null {
    const computeUnitsUsedMatch = log.match(LOG_COMPUTE_UNITS_REGEX);
    if (computeUnitsUsedMatch) return Number(computeUnitsUsedMatch[1]);
    return null;
}

/** @internal */
export function parseLogFailedToComplete(log: string): string | null {
    if (log.startsWith(LOG_FAILED_TO_COMPLETE_PREFIX)) return log.slice(LOG_FAILED_TO_COMPLETE_PREFIX.length);
    return null;
}
