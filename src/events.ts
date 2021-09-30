// Borrowed from https://github.com/project-serum/anchor/blob/master/ts/src/program/event.ts
import { PublicKey, Connection } from '@solana/web3.js';
import { ethers } from 'ethers';

import { parseLogTopic, parseLogLog } from './logs';

// Deserialized event data.
export type EventData = {
  data: string;
  topics: string[];
};

// Event callback.
export type EventCallback = (...args: any) => void;

// Log callback
export type LogCallback = (msg: string) => void;
export class EventManager {
  /**
   * Connection.
   */
  private _connection: Connection;

  /**
   * Event parser to handle onLogs callbacks.
   */
  private _logsParser: LogsParser;

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
    this._logsParser = new LogsParser();
    this._eventCallbacks = new Map();
    this._eventListeners = new Map();
    this._logCallbacks = new Map();
    this._listenerIdCount = 0;
  }

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
      this._eventListeners.get(eventHash).concat(listener)
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
        console.error(logs);
        return;
      }
      this._logsParser.parseLogs(logs.logs, (eventData, msg) => {
        for (const [, callback, abi] of this._eventCallbacks.values()) {
          let event;
          try {
            event = abi.parseLog(eventData);
          } catch (e) {
            console.log(e);
          }
          if (event) {
            callback(...event.args);
          }
        }

        if (msg) {
          for (const callback of this._logCallbacks.values()) {
            callback(msg);
          }
        }
      });
    });
  }

  private async stopProcessingLogs() {
    // Kill the websocket connection if all listeners have been removed.
    if (this._eventCallbacks.size == 0 && this._logCallbacks.size == 0) {
      await this._connection.removeOnLogsListener(this._onLogsSubscriptionId);
      this._onLogsSubscriptionId = undefined;
    }
  }
}

export class LogsParser {
  // Parse logs
  public parseLogs(
    logs: string[],
    callback: (eventData: EventData | null, msg: string) => void
  ) {
    const logScanner = new LogScanner(logs);
    let log = logScanner.next();
    while (log !== null) {
      console.log(log);
      const event = parseLogTopic(log);
      const msg = parseLogLog(log);
      if (event || msg) {
        callback(event, msg);
      }
      log = logScanner.next();
    }
  }
}

class LogScanner {
  constructor(public logs: string[]) {}

  next(): string | null {
    if (this.logs.length === 0) {
      return null;
    }
    let l = this.logs[0];
    this.logs = this.logs.slice(1);
    return l;
  }
}
