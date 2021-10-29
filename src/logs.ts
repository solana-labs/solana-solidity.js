import { defaultAbiCoder, LogDescription } from '@ethersproject/abi';
import { hexDataSlice } from '@ethersproject/bytes';
import { ConfirmOptions, Connection, Finality, sendAndConfirmTransaction, Signer, Transaction } from '@solana/web3.js';
import { Contract } from './contract';

const LOG_RETURN_PREFIX = 'Program return: ';
const LOG_LOG_PREFIX = 'Program log: ';
const LOG_COMPUTE_UNITS_RE = /consumed (\d+) of (\d+) compute units/i;
const LOG_DATA_PREFIX = 'Program data: ';
const LOG_FAILED_TO_COMPLETE_PREFIX = 'Program failed to complete: ';
const LOG_FAILED_RE = /(Program \w+ )?failed: (.*)$/;

export class TransactionError extends Error {
    public logs: string[];
    public computeUnitsUsed: number;

    constructor(message: string) {
        super(message);
        this.logs = [];
        this.computeUnitsUsed = 0;
    }
}

export interface EventData {
    data: string;
    topics: string[];
}

export type EventListener = (event: LogDescription) => void;

export type LogListener = (message: string) => void;

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
        this._subscriptionId ||= this._contract.connection.onLogs(this._contract.program, (logs, ctx) => {
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

export interface LogsResult {
    logs: string[];
    encoded: Buffer | null;
    computeUnitsUsed: number;
}

export async function simulateTransactionWithLogs(
    connection: Connection,
    transaction: Transaction,
    signers?: Signer[]
): Promise<LogsResult> {
    const simulateTxResult = await connection.simulateTransaction(transaction, signers);

    const logs = simulateTxResult.value.logs ?? [];
    const { log, encoded, computeUnitsUsed } = parseTxLogs(logs);

    if (simulateTxResult.value.err) throw parseTxError(encoded, computeUnitsUsed, log, logs);

    return { logs, encoded, computeUnitsUsed };
}

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

    const signature = await sendAndConfirmTransaction(connection, transaction, signers, confirmOptions);
    const parsedTx = await connection.getParsedConfirmedTransaction(signature, finality);

    const logs = parsedTx?.meta?.logMessages ?? [];
    const { encoded, computeUnitsUsed } = parseTxLogs(logs);

    return { logs, encoded, computeUnitsUsed };
}

/**
 * Parse tx `logs` for any:
 *  - "return" data
 *  - encoded log
 *  - compute units used
 *
 * @param logs
 * @return
 */
export function parseTxLogs(logs: string[]) {
    let encoded: Buffer | null = null;
    let computeUnitsUsed = 0;
    let log: string | null = null;

    for (const message of logs) {
        // return
        const _encoded = parseLogReturn(message);
        if (_encoded) encoded = _encoded;

        // failed to complete
        let _log = parseLogFailedToComplete(message);
        if (_log) log = _log;

        // log
        _log = parseLogLog(message);
        if (_log) log = _log;

        // compute units used
        const _computeUnitsUsed = parseLogComputeUnitsUsed(message);
        if (_computeUnitsUsed) computeUnitsUsed = _computeUnitsUsed;
    }

    return { encoded, computeUnitsUsed, log }; // todo: better naming
}

/**
 * Parse tx error in log `encoded` text. Also retrieve compute units used
 *
 * @param encoded
 * @param computeUnitsUsed
 * @param log
 * @param logs
 * @return
 */
export function parseTxError(encoded: Buffer | null, computeUnitsUsed: number, log: string | null, logs: string[]) {
    let txErr: TransactionError;

    if (log) {
        txErr = new TransactionError(log);
    } else {
        if (!encoded) {
            const failedMatch = logs[logs.length - 1].match(LOG_FAILED_RE);
            if (failedMatch) {
                txErr = new TransactionError(failedMatch[2]);
            } else {
                txErr = new TransactionError('return data or log not set');
            }
        }
        // else if (encoded?.readUInt32BE(0) != 0x08c379a0) {
        //   txErr = new TransactionError('signature not correct');
        // }
        else {
            const revertReason = defaultAbiCoder.decode(['string'], hexDataSlice(encoded, 4));
            txErr = new TransactionError(revertReason.toString());
        }
    }

    txErr.logs = logs;
    txErr.computeUnitsUsed = computeUnitsUsed;
    return txErr;
}

/**
 * Parse contract events in `log` e.g.:
 *    Program data: PUBqMYpHIn...
 *
 * @param log
 * @return
 */
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

/**
 * Parse "return" data in `log` e.g.:
 *    Program return: 9cgeQC4fKNtL4vAk59UBjJwyAgXocDVwZCcnNq5gHrqk
 *
 * @param log
 * @return
 */
function parseLogReturn(log: string) {
    if (log.startsWith(LOG_RETURN_PREFIX)) {
        const [, returnData] = log.slice(LOG_RETURN_PREFIX.length).split(' ');
        return Buffer.from(returnData, 'base64');
    }

    return null;
}

/**
 * Parse "log" data in `log` e.g.:
 *    Program log: denominator should not be zero'
 *
 * @param log
 * @return
 */
export function parseLogLog(log: string) {
    if (log.startsWith(LOG_LOG_PREFIX)) {
        return log.slice(LOG_LOG_PREFIX.length);
    }

    return null;
}

/**
 * Parse compute units in `log` e.g.:
 *   Program 9cgeQC4fKNtL4vAk59UBjJwyAgXocDVwZCcnNq5gHrqk consumed 1023 of 200000 compute units
 *
 * @param log
 * @return
 */
function parseLogComputeUnitsUsed(log: string) {
    const computeUnitsUsedMatch = log.match(LOG_COMPUTE_UNITS_RE);
    if (computeUnitsUsedMatch) {
        return Number(computeUnitsUsedMatch[1]);
    }

    return null;
}

/**
 * Parse 'failed to complete' log e.g.:
 *   Program failed to complete: divide by zero at instruction 592
 *
 * @param log
 * @return
 */
export function parseLogFailedToComplete(log: string) {
    if (log.startsWith(LOG_FAILED_TO_COMPLETE_PREFIX)) {
        return log.slice(LOG_FAILED_TO_COMPLETE_PREFIX.length);
    }
    return null;
}
