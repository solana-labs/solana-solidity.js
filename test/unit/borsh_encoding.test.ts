import { ParamType } from '@ethersproject/abi';
import { field, fixedArray, serialize, vec } from '@dao-xyz/borsh';
import { borshEncode } from '../../src/borsh';
import expect from 'expect';

describe('borsh encoding', () => {
    class PrimitiveTypes {
        @field({ type: 'u16' })
        param_zero: number;

        @field({ type: 'u128' })
        param_one: bigint;

        @field({ type: fixedArray('u8', 32) })
        param_two: Uint8Array;

        @field({ type: fixedArray('u8', 4) })
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
        const params: Array<ParamType> = [
            ParamType.fromString('int16'),
            ParamType.fromString('uint128'),
            ParamType.fromString('address'),
            ParamType.fromString('bytes4'),
            ParamType.fromString('bool'),
        ];

        const args: Array<any> = [
            -986523,
            BigInt(1924736120347601347),
            new Uint8Array([
                0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27,
                28, 29, 30, 31,
            ]),
            new Uint8Array([255, 250, 128, 65]),
            true,
        ];

        const encoded_from_typescript = borshEncode(params, args);
        const struct_to_encode = new PrimitiveTypes({
            param_zero: args[0],
            param_one: args[1],
            param_two: args[2],
            param_three: args[3],
            param_four: args[4],
        });
        const original_encoded = serialize(struct_to_encode);
        expect(encoded_from_typescript).toStrictEqual(original_encoded);
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

        @field({ type: fixedArray('u32', 4) })
        param_four: number[];

        @field({ type: vec('u32') })
        param_five: number[];

        constructor(data?: {
            zero: Uint8Array;
            one: string;
            two: number;
            three: number;
            four: number[];
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
        const params: Array<ParamType> = [
            ParamType.fromString('bytes'),
            ParamType.fromString('string'),
            ParamType.fromString('tuple(uint16, int8)'),
            ParamType.fromString('int32[4]'),
            ParamType.fromString('int32[]'),
        ];

        const args: Array<any> = [
            new Uint8Array([4, 5, 255, 238, 129]),
            'cappuccino',
            [856, -112],
            [5895, -89, 778, -7445],
            [85, -556],
        ];

        const encoded_from_typescript = borshEncode(params, args);
        const to_be_encoded = new ComplexTypes({
            zero: args[0],
            one: args[1],
            two: args[2][0],
            three: args[2][1],
            four: args[3],
            five: args[4],
        });

        const borsh_encoded = serialize(to_be_encoded);

        expect(encoded_from_typescript).toStrictEqual(borsh_encoded);
    });
});
