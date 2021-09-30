import { ethers } from 'ethers';

const LOG_RETURN_PREFIX = 'Program return: ';
const LOG_LOG_PREFIX = 'Program log: ';
const LOG_COMPUTE_UNITS_RE = /consumed (\d+) of (\d+) compute units/i;
const LOG_DATA_PREFIX = 'Program data: ';

export class TxError extends Error {
  public logs: string[];
  public computeUnitsUsed: number;
}

export function parseTxLogs(logs: string[]) {
  let encoded = null;
  let computeUnitsUsed = 0;
  let log = null;

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

export function parseTxError(
  encoded: Buffer | null,
  computeUnitsUsed: number,
  log: string | null,
  logs: string[]
) {
  let txErr: TxError;

  if (log) {
    txErr = new TxError(log);
  } else {
    if (!encoded) {
      txErr = new TxError('return data or log not set');
    }
    // else if (encoded?.readUInt32BE(0) != 0x08c379a0) {
    //   txErr = new TxError('signature not correct');
    // }
    else {
      const revertReason = ethers.utils.defaultAbiCoder.decode(
        ['string'],
        ethers.utils.hexDataSlice(encoded, 4)
      );
      // console.log(revertReason.toString(), computeUnitsUsed);
      txErr = new TxError(revertReason.toString());
    }
  }

  txErr.logs = logs;
  txErr.computeUnitsUsed = computeUnitsUsed;
  return txErr;
}

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

function parseLogReturn(log: string) {
  if (log.startsWith(LOG_RETURN_PREFIX)) {
    const [, returnData] = log.slice(LOG_RETURN_PREFIX.length).split(' ');
    return Buffer.from(returnData, 'base64');
  }

  return null;
}

export function parseLogLog(log: string) {
  if (log.startsWith(LOG_LOG_PREFIX)) {
    return log.slice(LOG_LOG_PREFIX.length);
  }

  return null;
}

function parseLogComputeUnitsUsed(log: string) {
  const computeUnitsUsedMatch = log.match(LOG_COMPUTE_UNITS_RE);
  if (computeUnitsUsedMatch) {
    return Number(computeUnitsUsedMatch[1]);
  }

  return null;
}
