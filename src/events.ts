// Borrowed from https://github.com/project-serum/anchor/blob/master/ts/src/program/event.ts
import { PublicKey, Connection } from '@solana/web3.js';
import * as assert from 'assert';
import { ethers } from 'ethers';

const LOG_DATA_PREFIX = 'Program data: ';

// Deserialized event data.
export type EventData = {
  data: string;
  topics: string[];
};

// Event callback.
export type EventCallback = (event: any, slot: number) => void;

export class EventManager {
  /**
   * Connection.
   */
  private _connection: Connection;

  /**
   * Event parser to handle onLogs callbacks.
   */
  private _eventParser: EventParser;

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
   * The next listener id to allocate.
   */
  private _listenerIdCount: number;

  /**
   * The subscription id from the connection onLogs subscription.
   */
  private _onLogsSubscriptionId: number | undefined;

  constructor(connection: Connection) {
    this._connection = connection;
    this._eventParser = new EventParser();
    this._eventCallbacks = new Map();
    this._eventListeners = new Map();
    this._listenerIdCount = 0;
  }

  public addEventListener(
    abi: ethers.utils.Interface,
    eventName: string,
    callback: (event: any, slot: number) => void
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

    this._onLogsSubscriptionId = this._connection.onLogs('all', (logs, ctx) => {
      if (logs.err) {
        console.error(logs);
        return;
      }
      this._eventParser.parseLogs(logs.logs, (eventData) => {
        for (const [, callback, abi] of this._eventCallbacks.values()) {
          let event;
          try {
            event = abi.parseLog(eventData);
          } catch (e) {
            console.log(e);
          }
          if (event) {
            callback(event.args, ctx.slot);
          }
        }
      });
    });

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

    // Kill the websocket connection if all listeners have been removed.
    if (this._eventCallbacks.size == 0) {
      assert.ok(this._eventListeners.size === 0);
      await this._connection.removeOnLogsListener(this._onLogsSubscriptionId);
      this._onLogsSubscriptionId = undefined;
    }
  }
}

export class EventParser {
  // Parse logs
  public parseLogs(logs: string[], callback: (log: EventData) => void) {
    const logScanner = new LogScanner(logs);
    let log = logScanner.next();
    while (log !== null) {
      let event = this.handleLog(log);
      if (event) {
        callback(event);
      }
      log = logScanner.next();
    }
  }

  // Handles logs from *this* program.
  private handleLog(log: string): EventData | null {
    // Program data log.
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

    // Other log.
    return null;
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
