import { ParamType, Result } from '@ethersproject/abi';
import { BinaryReader, BinaryWriter } from '@dao-xyz/borsh';
import BN from 'bn.js';

/**
 * Encode the arguments of a function using Borsh encoding
 * @param params an array containing the description of each parameter
 * @param values an array containing the arguments
 */
export function borshEncode(params: ReadonlyArray<ParamType>, values: ReadonlyArray<any>): Uint8Array {
    const writer = new SolidityWriter();
    const total_params = params.length;
    for (let i = 0; i < total_params; i++) {
        encodeParam(params[i], values[i], writer);
    }
    return writer.toArray();
}

/** @internal
 * Encode a single function parameter
 * @param param a function parameter
 * @param value the argument passed for that parameter
 * @param writer the entity that writes to a buffer
 */
function encodeParam(param: ParamType, value: any, writer: SolidityWriter) {
    switch (param.baseType) {
        case 'int8': {
            writer.writeI8(value);
            break;
        }
        case 'uint8': {
            writer.writeU8(value);
            break;
        }
        case 'int16': {
            writer.writeI16(value);
            break;
        }
        case 'uint16': {
            writer.writeU16(value);
            break;
        }
        case 'int32': {
            writer.writeI32(value);
            break;
        }
        case 'uint32': {
            writer.writeU32(value);
            break;
        }
        case 'int64': {
            writer.writeI64(BigInt(value));
            break;
        }
        case 'uint64': {
            writer.writeU64(value);
            break;
        }
        case 'int128': {
            writer.writeI128(value);
            break;
        }
        case 'uint128': {
            writer.writeU128(value);
            break;
        }
        case 'int256': {
            writer.writeI256(value);
            break;
        }
        case 'uint256': {
            writer.writeU256(value);
            break;
        }

        case 'address': {
            writer.writeFixedArray(value);
            break;
        }

        case 'bytes1':
        case 'bytes2':
        case 'bytes3':
        case 'bytes4':
        case 'bytes5':
        case 'bytes6':
        case 'bytes7':
        case 'bytes8':
        case 'bytes9':
        case 'bytes10':
        case 'bytes11':
        case 'bytes12':
        case 'bytes13':
        case 'bytes14':
        case 'bytes15':
        case 'bytes16':
        case 'bytes17':
        case 'bytes18':
        case 'bytes19':
        case 'bytes20':
        case 'bytes21':
        case 'bytes22':
        case 'bytes23':
        case 'bytes24':
        case 'bytes25':
        case 'bytes26':
        case 'bytes27':
        case 'bytes28':
        case 'bytes29':
        case 'bytes30':
        case 'bytes31':
        case 'bytes32': {
            writer.writeFixedArray(value);
            break;
        }

        case 'bool': {
            writer.writeBool(value);
            break;
        }

        case 'bytes': {
            writer.writeU32(value.length);
            writer.writeFixedArray(value);
            break;
        }

        case 'string': {
            writer.writeString(value);
            break;
        }

        case 'tuple': {
            const items_len = param.components.length;
            for (let i = 0; i < items_len; i++) {
                encodeParam(param.components[i], value[i], writer);
            }
            break;
        }

        case 'array': {
            let len = 0;
            if (param.arrayLength == -1) {
                writer.writeU32(value.length);
                len = value.length;
            } else {
                len = param.arrayLength;
            }
            for (let i = 0; i < len; i++) {
                encodeParam(param.arrayChildren, value[i], writer);
            }
            break;
        }
    }
}

/**
 * Decodes the returns of a function
 * @param params an array containing the description of each return
 * @param encoded a buffer that holds the encoded returns
 */
export function borshDecode(params: ArrayLike<ParamType>, encoded: Buffer): Result {
    const decoded_items: Array<any> = new Array<any>();
    const reader = new SolidityBinaryReader(encoded);
    for (let i = 0; i < params.length; i++) {
        const item = decodeParam(params[i], reader);
        decoded_items.push(item);
    }

    return decoded_items;
}

/**
 * @internal
 * Read a returned item from a buffer
 * @param param the parameter we want to read
 * @param reader the entity that reads from the buffer
 */
function decodeParam(param: ParamType, reader: SolidityBinaryReader): any {
    switch (param.baseType) {
        case 'int8': {
            return reader.readI8();
        }
        case 'uint8': {
            return reader.readU8();
        }
        case 'int16': {
            return reader.readI16();
        }
        case 'uint16': {
            return reader.readU16();
        }
        case 'int32': {
            return reader.readI32();
        }
        case 'uint32': {
            return reader.readU32();
        }
        case 'int64': {
            return reader.readI64();
        }
        case 'uint64': {
            return reader.readU64();
        }
        case 'int128': {
            return reader.readI128();
        }
        case 'uint128': {
            return reader.readU128();
        }
        case 'int256': {
            return reader.readI256();
        }
        case 'uint256': {
            return reader.readU256();
        }
        case 'bytes1': {
            return reader.readFixedArray(1);
        }
        case 'bytes2': {
            return reader.readFixedArray(2);
        }
        case 'bytes3': {
            return reader.readFixedArray(3);
        }
        case 'bytes4': {
            return reader.readFixedArray(4);
        }
        case 'bytes5': {
            return reader.readFixedArray(5);
        }
        case 'bytes6': {
            return reader.readFixedArray(6);
        }
        case 'bytes7': {
            return reader.readFixedArray(7);
        }
        case 'bytes8': {
            return reader.readFixedArray(8);
        }
        case 'bytes9': {
            return reader.readFixedArray(9);
        }
        case 'bytes10': {
            return reader.readFixedArray(10);
        }
        case 'bytes11': {
            return reader.readFixedArray(11);
        }
        case 'bytes12': {
            return reader.readFixedArray(12);
        }
        case 'bytes13': {
            return reader.readFixedArray(13);
        }
        case 'bytes14': {
            return reader.readFixedArray(14);
        }
        case 'bytes15': {
            return reader.readFixedArray(15);
        }
        case 'bytes16': {
            return reader.readFixedArray(16);
        }
        case 'bytes17': {
            return reader.readFixedArray(17);
        }
        case 'bytes18': {
            return reader.readFixedArray(18);
        }
        case 'bytes19': {
            return reader.readFixedArray(19);
        }
        case 'bytes20': {
            return reader.readFixedArray(20);
        }
        case 'bytes21': {
            return reader.readFixedArray(21);
        }
        case 'bytes22': {
            return reader.readFixedArray(22);
        }
        case 'bytes23': {
            return reader.readFixedArray(23);
        }
        case 'bytes24': {
            return reader.readFixedArray(24);
        }
        case 'bytes25': {
            return reader.readFixedArray(25);
        }
        case 'bytes26': {
            return reader.readFixedArray(26);
        }
        case 'bytes27': {
            return reader.readFixedArray(27);
        }
        case 'bytes28': {
            return reader.readFixedArray(28);
        }
        case 'bytes29': {
            return reader.readFixedArray(29);
        }
        case 'bytes30': {
            return reader.readFixedArray(30);
        }
        case 'bytes31': {
            return reader.readFixedArray(31);
        }
        case 'address':
        case 'bytes32': {
            return reader.readFixedArray(32);
        }

        case 'bool': {
            return reader.readBool();
        }

        case 'bytes': {
            const len = reader.readU32();
            return reader.readFixedArray(len);
        }

        case 'string': {
            return reader.readString();
        }

        case 'tuple': {
            const tuple_len = param.components.length;
            const response: Array<any> = new Array<any>();
            for (let i = 0; i < tuple_len; i++) {
                response.push(decodeParam(param.components[i], reader));
            }
            return response;
        }

        case 'array': {
            let len = 0;
            if (param.arrayLength == -1) {
                len = reader.readU32();
            } else {
                len = param.arrayLength;
            }
            const response: Array<any> = new Array<any>();
            for (let i = 0; i < len; i++) {
                response.push(decodeParam(param.arrayChildren, reader));
            }
            return response;
        }
    }
}

/**
 * This class extends BinaryReader to implement function for reading signed numbers from a borsh encoded buffer.
 */
class SolidityBinaryReader extends BinaryReader {
    public constructor(buf: Buffer) {
        super(buf);
    }

    readI8(): number {
        const value = this.buf.getInt8(this.offset);
        this.offset += 1;
        return value;
    }

    readI16(): number {
        const value = this.buf.getInt16(this.offset, true);
        this.offset += 2;
        return value;
    }

    readI32(): number {
        const value = this.buf.getInt32(this.offset, true);
        this.offset += 4;
        return value;
    }

    readI64(): bigint {
        const value = this.buf.getBigInt64(this.offset, true);
        this.offset += 8;
        return value;
    }

    readI128(): bigint {
        const read = this.readFixedArray(16);
        let bigNumber = new BN(read, 'le');
        bigNumber = bigNumber.fromTwos(128);
        const str = bigNumber.toString();
        return BigInt(str);
    }

    readI256(): bigint {
        const read = this.readFixedArray(32);
        let bigNumber = new BN(read, 'le');
        bigNumber = bigNumber.fromTwos(256);
        const str = bigNumber.toString();
        return BigInt(str);
    }
}

/**
 * This class extends BinaryWrite to implement function that write signed numbers when borsh encoding
 */
class SolidityWriter extends BinaryWriter {
    constructor() {
        super();
    }

    writeI8(value: number) {
        this.maybeResize();
        this.buf.setInt8(this.length, value);
        this.length += 1;
    }

    writeI16(value: number) {
        this.maybeResize();
        this.buf.setInt16(this.length, value, true);
        this.length += 2;
    }

    writeI32(value: number) {
        this.maybeResize();
        this.buf.setInt32(this.length, value, true);
        this.length += 4;
    }

    writeI64(value: bigint) {
        this.maybeResize();
        this.buf.setBigInt64(this.length, value, true);
        this.length += 8;
    }

    writeI128(value: bigint) {
        let bigNumber = new BN(value.toString());
        bigNumber = bigNumber.toTwos(128);
        const arrayLike = bigNumber.toBuffer('le', 16);
        this.writeFixedArray(arrayLike);
    }

    writeI256(value: bigint) {
        let bigNumber = new BN(value.toString());
        bigNumber = bigNumber.toTwos(256);
        const arrayLike = bigNumber.toBuffer('le', 32);
        this.writeFixedArray(arrayLike);
    }
}
