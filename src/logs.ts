import { Connection } from '@solana/web3.js';
import { ethers } from 'ethers';

const LOG_RETURN_PREFIX = 'Program return: ';
const LOG_LOG_PREFIX = 'Program log: ';
const LOG_COMPUTE_UNITS_RE = /consumed (\d+) of (\d+) compute units/i;
const LOG_DATA_PREFIX = 'Program data: ';

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
export type EventCallback = (...args: any) => void;

// Log callback.
export type LogCallback = (msg: string) => void;

export class LogsParser {
  /**
   * Connection.
   */
  private _connection: Connection;

  /**
   * Maps event listener id to [event-name, callback].
   */
  private _eventCallbacks: Map<
    number,
    [string, EventCallback, ethers.utils.Interface]
  >;

  /**
   * Maps event name to all listeners for the event.
   */
  private _eventListeners: Map<string, Array<number>>;

  /**
   * Maps log listener id to callback.
   */
  private _logCallbacks: Map<number, LogCallback>;

  /**
   * The next listener id to allocate.
   */
  private _listenerIdCount: number;

  /**
   * The subscription id from the connection onLogs subscription.
   */
  private _onLogsSubscriptionId: number | undefined;

  constructor(connection: Connection) {
    this._connection = connection;
    this._eventCallbacks = new Map();
    this._eventListeners = new Map();
    this._logCallbacks = new Map();
    this._listenerIdCount = 0;
  }

  /**
   *
   * @param abi
   * @param eventName
   * @param callback
   * @returns
   */
  public addEventListener(
    abi: ethers.utils.Interface,
    eventName: string,
    callback: EventCallback
  ): number {
    let listener = this._listenerIdCount;
    this._listenerIdCount += 1;

    const eventHash = abi.getEventTopic(eventName);

    // Store the listener into the event map.
    if (!(eventHash in this._eventCallbacks)) {
      this._eventListeners.set(eventHash, []);
    }
    this._eventListeners.set(
      eventHash,
      (this._eventListeners.get(eventHash) ?? []).concat(listener)
    );

    // Store the callback into the listener map.
    this._eventCallbacks.set(listener, [eventHash, callback, abi]);

    // Create the subscription singleton, if needed.
    if (this._onLogsSubscriptionId !== undefined) {
      return listener;
    }

    this.processLogs();

    return listener;
  }

  /**
   *
   * @param listener
   */
  public async removeEventListener(listener: number): Promise<void> {
    // Get the callback.
    const callback = this._eventCallbacks.get(listener);
    if (!callback) {
      throw new Error(`Event listener ${listener} doesn't exist!`);
    }
    const [eventName] = callback;

    // Get the listeners.
    let listeners = this._eventListeners.get(eventName);
    if (!listeners) {
      throw new Error(`Event listeners don't exist for ${eventName}!`);
    }

    // Update both maps.
    this._eventCallbacks.delete(listener);
    listeners = listeners.filter((l) => l !== listener);
    if (listeners.length === 0) {
      this._eventListeners.delete(eventName);
    }

    await this.stopProcessingLogs();
  }

  /**
   *
   * @param callback
   * @returns
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
   *
   * @param listener
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

  private getNewListenerId() {
    this._listenerIdCount += 1;
    return this._listenerIdCount;
  }

  private processLogs() {
    this._onLogsSubscriptionId = this._connection.onLogs('all', (logs, ctx) => {
      if (logs.err) {
        return;
      }
      for (const log of logs.logs) {
        const eventData = parseLogTopic(log);
        const msg = parseLogLog(log);

        if (eventData) {
          for (const [, callback, abi] of this._eventCallbacks.values()) {
            let event: ethers.utils.LogDescription | null = null;
            try {
              event = abi.parseLog(eventData);
            } catch (e) {
              // console.log(e);
            }
            if (event) {
              callback(...event.args);
            }
          }
        }

        if (msg) {
          for (const callback of this._logCallbacks.values()) {
            callback(msg);
          }
        }
      }
    });
  }

  /**
   *
   */
  private async stopProcessingLogs() {
    // Kill the websocket connection if all listeners have been removed.
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
 * Parse tx `logs` for any "return" data, "log" or compute units used.
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

    // log
    const _log = parseLogLog(message);
    if (_log) log = _log;

    // compute units used
    const _computeUnitsUsed = parseLogComputeUnitsUsed(message);
    if (_computeUnitsUsed) computeUnitsUsed = _computeUnitsUsed;
  }

  return { encoded, computeUnitsUsed, log };
}

/**
 * Parse tx error in log `encoded` text. Also retrieve compute units used.
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
      const revertReason = ethers.utils.defaultAbiCoder.decode(
        ['string'],
        ethers.utils.hexDataSlice(encoded, 4)
      );
      // console.log(revertReason.toString(), computeUnitsUsed);
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
