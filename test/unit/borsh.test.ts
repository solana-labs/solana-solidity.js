import { ParamType } from '@ethersproject/abi';
import { borshDecode, borshEncode } from '../../src/borsh';
import expect from 'expect';

describe('borsh encode and decode', () => {
    it('signed integers', async function () {
        const params: Array<ParamType> = [
            ParamType.fromString('int8'),
            ParamType.fromString('int16'),
            ParamType.fromString('int32'),
            ParamType.fromString('int64'),
            ParamType.fromString('int128'),
            ParamType.from('int256'),
        ];

        const args = [-90, -3322, -2134123, BigInt(-72344), BigInt(-9123123), BigInt(-6612344554)];

        const encoded = borshEncode(params, args);
        const decoded = borshDecode(params, Buffer.from(encoded));

        expect(decoded[0]).toStrictEqual(args[0]);
        expect(decoded[1]).toStrictEqual(args[1]);
        expect(decoded[2]).toStrictEqual(args[2]);
        expect(decoded[3]).toStrictEqual(args[3]);
        expect(decoded[4]).toStrictEqual(args[4]);
        expect(decoded[5]).toStrictEqual(args[5]);
    });

    it('unsigned integers', async function () {
        const params: Array<ParamType> = [
            ParamType.fromString('uint8'),
            ParamType.fromString('uint16'),
            ParamType.fromString('uint32'),
            ParamType.fromString('uint64'),
            ParamType.fromString('uint128'),
            ParamType.from('uint256'),
        ];

        const args = [90, 3322, 2134123, BigInt(72344), BigInt(9123123), BigInt(6612344554)];

        const encoded = borshEncode(params, args);
        const decoded = borshDecode(params, Buffer.from(encoded));

        expect(decoded[0]).toStrictEqual(args[0]);
        expect(decoded[1]).toStrictEqual(args[1]);
        expect(decoded[2]).toStrictEqual(args[2]);
        expect(decoded[3]).toStrictEqual(args[3]);
        expect(decoded[4]).toStrictEqual(args[4]);
        expect(decoded[5]).toStrictEqual(args[5]);
    });

    it('bytes', async function () {
        for (let i = 2; i < 33; i++) {
            const params = [
                ParamType.fromString('bytes' + (i - 1).toString()),
                ParamType.fromString('bytes' + i.toString()),
            ];
            const args = [new Uint8Array(i - 1), new Uint8Array(i)];

            const encoded = borshEncode(params, args);
            const decoded = borshDecode(params, Buffer.from(encoded));
            expect(decoded[0]).toStrictEqual(args[0]);
            expect(decoded[1]).toStrictEqual(args[1]);
        }
    });
});
