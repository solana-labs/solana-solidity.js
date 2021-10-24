import { Connection, PublicKey } from '@solana/web3.js';
import { LogDescription, Interface, defaultAbiCoder } from '@ethersproject/abi';
import { hexDataSlice } from '@ethersproject/bytes';

const LOG_RETURN_PREFIX = 'Program return: ';
const LOG_LOG_PREFIX = 'Program log: ';
const LOG_COMPUTE_UNITS_RE = /consumed (\d+) of (\d+) compute units/i;
const LOG_DATA_PREFIX = 'Program data: ';
const LOG_FAILED_TO_COMPLETE_PREFIX = 'Program failed to complete: ';

export class TransactionError extends Error {
  public logs: string[];
  public computeUnitsUsed: number;

  constructor(msg: string) {
    super(msg);
    this.logs = [];
    this.computeUnitsUsed = 0;
  }
}

// Deserialized event data.
export type EventData = {
  data: string;
  topics: string[];
};

// Event callback.
export type EventCallback = (event: LogDescription) => void;

// Log callback.
export type LogCallback = (msg: string) => void;

export class LogsParser {
  /**
   * Program ID for event subscriptions.
   */
  protected _programId: PublicKey;

  /**
   * Connection.
   */
  protected _connection: Connection;

  /**
   * The next listener id to allocate.
   */
  protected _listenerIdCount: number;

  /**
   * Maps event listener id to [abi, callback].
   */
  protected _eventCallbacks: Map<number, [Interface, EventCallback]>;

  /**
   * Maps log listener id to callback.
   */
  protected _logCallbacks: Map<number, LogCallback>;

  /**
   * The subscription id from the connection onLogs subscription.
   */
  protected _onLogsSubscriptionId: number | undefined;

  /**
   * Creates a new instance of LogsParser
   * 
   * @param programId 
   * @param connection 
   */
  constructor(programId: PublicKey, connection: Connection) {
    this._programId = programId;
    this._connection = connection;
    this._eventCallbacks = new Map();
    this._logCallbacks = new Map();
    this._listenerIdCount = 0;
  }

  /**
   * Subscribe to events of `abi`, invoking `callback` on every emit
   * 
   * @param abi       The contract ABI
   * @param callback  Callback to invoke
   * @returns         Listener id
   */
  public addEventListener(abi: Interface, callback: EventCallback): number {
    let listener = this.getNewListenerId();

    // Store the callback into the events listeners map.
    this._eventCallbacks.set(listener, [abi, callback]);

    // Create the subscription singleton, if needed.
    if (this._onLogsSubscriptionId !== undefined) {
      return listener;
    }

    this.processLogs();

    return listener;
  }

  /**
   * Unsubscribe events listener of id `listener`.
   * 
   * @param listener Listener id
   */
  public async removeEventListener(listener: number): Promise<void> {
    // Get the callback.
    const callback = this._eventCallbacks.get(listener);
    if (!callback) {
      throw new Error(`Event listener ${listener} doesn't exist!`);
    }

    this._eventCallbacks.delete(listener);

    await this.stopProcessingLogs();
  }

  /**
   * Subscribe to program logs, invoking `callback` on every emit
   * 
   * @param callback  Callback to invoke
   * @returns         Listener id
   */
  public addLogListener(callback: LogCallback): number {
    let listener = this.getNewListenerId();

    // Store the callback into the log listeners map.
    this._logCallbacks.set(listener, callback);

    // Create the subscription singleton, if needed.
    if (this._onLogsSubscriptionId !== undefined) {
      return listener;
    }

    this.processLogs();

    return listener;
  }

  /**
   * Unsubscribe logs listener of id `listener`
   * 
   * @param listener - Listener id
   */
  public async removeLogListener(listener: number): Promise<void> {
    // Get the callback.
    const callback = this._logCallbacks.get(listener);
    if (!callback) {
      throw new Error(`Log listener ${listener} doesn't exist!`);
    }

    this._logCallbacks.delete(listener);

    await this.stopProcessingLogs();
  }

  /**
   * Generate new listener id
   * 
   * @returns Listener id
   */
  protected getNewListenerId() {
    this._listenerIdCount += 1;
    return this._listenerIdCount;
  }

  /**
   * Create an events + logs listener and parser singleton
   */
  protected processLogs() {
    this._onLogsSubscriptionId = this._connection.onLogs(
      this._programId,
      (logs, ctx) => {
        if (logs.err) {
          return;
        }
        for (const log of logs.logs) {
          const eventData = parseLogTopic(log);
          const msg = parseLogLog(log);

          if (eventData) {
            for (const [abi, callback] of this._eventCallbacks.values()) {
              let event: LogDescription | null = null;
              try {
                event = abi.parseLog(eventData);
              } catch (e) {
                // console.log(e);
              }
              if (event) {
                callback(event);
              }
            }
          }

          if (msg) {
            for (const callback of this._logCallbacks.values()) {
              callback(msg);
            }
          }
        }
      }
    );
  }

  /**
   * Kill the websocket connection if all listeners have been removed
   */
  protected async stopProcessingLogs() {
    if (
      this._eventCallbacks.size == 0 &&
      this._logCallbacks.size == 0 &&
      this._onLogsSubscriptionId
    ) {
      await this._connection.removeOnLogsListener(this._onLogsSubscriptionId);
      this._onLogsSubscriptionId = undefined;
    }
  }
}

/**
 * Parse tx `logs` for any "return" data, "log" or compute units used
 *
 * @param logs
 * @returns
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

  return { encoded, computeUnitsUsed, log };
}

/**
 * Parse tx error in log `encoded` text. Also retrieve compute units used
 *
 * @param encoded
 * @param computeUnitsUsed
 * @param log
 * @param logs
 * @returns
 */
export function parseTxError(
  encoded: Buffer | null,
  computeUnitsUsed: number,
  log: string | null,
  logs: string[]
) {
  let txErr: TransactionError;

  if (log) {
    txErr = new TransactionError(log);
  } else {
    if (!encoded) {
      txErr = new TransactionError('return data or log not set');
    }
    // else if (encoded?.readUInt32BE(0) != 0x08c379a0) {
    //   txErr = new TransactionError('signature not correct');
    // }
    else {
      const revertReason = defaultAbiCoder.decode(
        ['string'],
        hexDataSlice(encoded, 4)
      );
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
 * @returns
 */
export function parseLogTopic(log: string) {
  if (log.startsWith(LOG_DATA_PREFIX)) {
    const fields = log.slice(LOG_DATA_PREFIX.length).split(' ');
    if (fields.length == 2) {
      const topicData = Buffer.from(fields[0], 'base64');
      const topics: string[] = [];
      for (let offset = 0; offset < topicData.length; offset += 32) {
        topics.push(
          '0x' + topicData.subarray(offset, offset + 32).toString('hex')
        );
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
 * @returns
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
 * @returns
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
 * @returns
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
 * @returns
 */
export function parseLogFailedToComplete(log: string) {
  if (log.startsWith(LOG_FAILED_TO_COMPLETE_PREFIX)) {
    return log.slice(LOG_FAILED_TO_COMPLETE_PREFIX.length);
  }

  return null;
}
