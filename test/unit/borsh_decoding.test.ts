import { field, fixedArray, serialize, vec } from '@dao-xyz/borsh';
import { ParamType } from '@ethersproject/abi';
import { borshDecode } from '../../src/borsh';
import expect from 'expect';

describe('borsh decoding', () => {
    class PrimitiveTypes {
        @field({ type: 'u32' })
        param_zero: number;

        @field({ type: 'u256' })
        param_one: bigint;

        @field({ type: fixedArray('u8', 32) })
        param_two: Uint8Array;

        @field({ type: fixedArray('u8', 5) })
        param_three: Uint8Array;

        @field({ type: 'bool' })
        param_four: boolean;

        constructor(data?: {
            param_zero: number;
            param_one: bigint;
            param_two: Uint8Array;
            param_three: Uint8Array;
            param_four: boolean;
        }) {
            if (data) {
                this.param_zero = data.param_zero;
                this.param_one = data.param_one;
                this.param_two = data.param_two;
                this.param_three = data.param_three;
                this.param_four = data.param_four;
            } else {
                this.param_zero = 0;
                this.param_one = BigInt(0);
                this.param_two = new Uint8Array();
                this.param_three = new Uint8Array();
                this.param_four = false;
            }
        }
    }
    it('primitive types', async function () {
        const struct_to_encode = new PrimitiveTypes({
            param_zero: 896514,
            param_one: BigInt(89663333221478),
            param_two: new Uint8Array([
                32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6,
                5, 4, 3, 2, 1,
            ]),
            param_three: new Uint8Array([255, 254, 253, 252, 251]),
            param_four: false,
        });
        const encoded = serialize(struct_to_encode);
        const params: Array<ParamType> = [
            ParamType.fromString('uint32'),
            ParamType.fromString('uint256'),
            ParamType.fromString('address'),
            ParamType.fromString('bytes5'),
            ParamType.fromString('bool'),
        ];

        const decoded = borshDecode(params, Buffer.from(encoded));

        expect(decoded[0]).toStrictEqual(struct_to_encode.param_zero);
        expect(decoded[1]).toStrictEqual(struct_to_encode.param_one);
        expect(decoded[2]).toStrictEqual(struct_to_encode.param_two);
        expect(decoded[3]).toStrictEqual(struct_to_encode.param_three);
        expect(decoded[4]).toStrictEqual(struct_to_encode.param_four);
    });

    class ComplexTypes {
        @field({ type: vec('u8') })
        param_zero: Uint8Array;

        @field({ type: 'string' })
        param_one: string;

        @field({ type: 'u16' })
        param_two: number;

        @field({ type: 'u8' })
        param_three: number;

        @field({ type: fixedArray('u64', 4) })
        param_four: bigint[];

        @field({ type: vec('u32') })
        param_five: number[];

        constructor(data?: {
            zero: Uint8Array;
            one: string;
            two: number;
            three: number;
            four: bigint[];
            five: number[];
        }) {
            if (data) {
                this.param_zero = data.zero;
                this.param_one = data.one;
                this.param_two = data.two;
                this.param_three = data.three;
                this.param_four = data.four;
                this.param_five = data.five;
            } else {
                this.param_zero = new Uint8Array();
                this.param_one = '';
                this.param_two = 0;
                this.param_three = 0;
                this.param_four = [];
                this.param_five = [];
            }
        }
    }

    it('complex types', async function () {
        const struct_to_encode = new ComplexTypes({
            zero: new Uint8Array([24, 45, 44, 33, 87, 65]),
            one: 'tea',
            two: -98,
            three: -9,
            four: [BigInt(23), BigInt(1234134), BigInt(1874085), BigInt(4324)],
            five: [900, 9230, 42],
        });

        const encoded = serialize(struct_to_encode);
        const params: Array<ParamType> = [
            ParamType.fromString('bytes'),
            ParamType.from('string'),
            ParamType.from('tuple(int16, int8)'),
            ParamType.from('uint64[4]'),
            ParamType.from('uint32[]'),
        ];
        const res = borshDecode(params, Buffer.from(encoded));

        expect(res[0]).toStrictEqual(struct_to_encode.param_zero);
        expect(res[1]).toStrictEqual(struct_to_encode.param_one);
        expect(res[2]).toStrictEqual([struct_to_encode.param_two, struct_to_encode.param_three]);
        expect(res[3]).toStrictEqual(struct_to_encode.param_four);
        expect(res[4]).toStrictEqual(struct_to_encode.param_five);
    });
});
