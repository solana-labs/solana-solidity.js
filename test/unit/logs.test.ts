import { Interface } from '@ethersproject/abi';
import expect from 'expect';
import { parseLogTopic, parseSimulationError, parseTransactionLogs } from '../../src/logs';

describe('logs', () => {
    it('parses "Program return:" logs', async function () {
        const { encoded, computeUnitsUsed } = parseTransactionLogs([
            'Program CwWevKx4bF1LKFdCXSJV7yxGaMZDkNCMpp1EhJEGkif invoke [1]',
            'Program CwWevKx4bF1LKFdCXSJV7yxGaMZDkNCMpp1EhJEGkif consumed 837 of 200000 compute units',
            'Program return: CwWevKx4bF1LKFdCXSJV7yxGaMZDkNCMpp1EhJEGkif AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABlNvbGFuYQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
            'Program CwWevKx4bF1LKFdCXSJV7yxGaMZDkNCMpp1EhJEGkif success',
        ]);
        expect(computeUnitsUsed).toBeGreaterThan(800);
        expect(computeUnitsUsed).toBeLessThan(900);

        const abi = new Interface([
            {
                name: 'name',
                type: 'function',
                inputs: [],
                outputs: [{ name: '', type: 'string' }],
                stateMutability: 'view',
            },
        ]);
        const fragment = abi.getFunction('name');
        const args = abi.decodeFunctionResult(fragment, encoded!);
        expect(args[0]).toEqual('Solana');
    });

    it('parses errors in "Program return:" logs', async function () {
        const logs = [
            'Program 9cgeQC4fKNtL4vAk59UBjJwyAgXocDVwZCcnNq5gHrqk invoke [1]',
            'Program 9cgeQC4fKNtL4vAk59UBjJwyAgXocDVwZCcnNq5gHrqk consumed 1023 of 200000 compute units',
            'Program return: 9cgeQC4fKNtL4vAk59UBjJwyAgXocDVwZCcnNq5gHrqk CMN5oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABNEbyB0aGUgcmV2ZXJ0IHRoaW5nAAAAAAAAAAAAAAAAAA==',
            'Program 9cgeQC4fKNtL4vAk59UBjJwyAgXocDVwZCcnNq5gHrqk failed: custom program error: 0x0',
        ];
        const { encoded, computeUnitsUsed } = parseTransactionLogs(logs);
        expect(computeUnitsUsed).toBeGreaterThan(1000);
        expect(computeUnitsUsed).toBeLessThan(1100);

        const err = parseSimulationError(encoded, computeUnitsUsed, null, logs);
        expect(err.message).toBe('Do the revert thing');
        expect(err.computeUnitsUsed).toBe(1023);
        expect(err.logs.length).toBeGreaterThan(1);
    });

    it('parses "Program log:" logs', async function () {
        const { computeUnitsUsed, log } = parseTransactionLogs([
            'Program D7Foi9gGkj3rQrUHNSg9GxWHMeVZsF8WptjZn5GFjJRV invoke [1]',
            'Program log: denominator should not be zero',
            'Program D7Foi9gGkj3rQrUHNSg9GxWHMeVZsF8WptjZn5GFjJRV consumed 1438 of 200000 compute units',
            'Program D7Foi9gGkj3rQrUHNSg9GxWHMeVZsF8WptjZn5GFjJRV failed: custom program error: 0x0',
        ]);
        expect(computeUnitsUsed).toBeGreaterThan(1400);
        expect(computeUnitsUsed).toBeLessThan(1500);
        expect(log).toEqual('denominator should not be zero');
    });

    it('parses "Program data:" logs', async function () {
        const { data, topics } = parseLogTopic(
            'Program data: PUBqMYpHInIBMuX3TXZKuYGHwf1juv3K+2eNQrEUqo4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAeibA== QUJDRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEyv4BIwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
        )!;

        const abi = new Interface([
            {
                name: 'Second',
                type: 'event',
                inputs: [
                    { name: 'a', type: 'int256', indexed: true },
                    { name: 'b', type: 'bytes4' },
                    { name: 'c', type: 'bytes' },
                ],
                anonymous: false,
            },
        ]);

        const { name, args } = abi.parseLog({ data, topics });

        expect(name).toEqual('Second');
        expect(args[0].toString()).toEqual('500332');
        expect(args[1]).toEqual('0x41424344');
        expect(args[2]).toEqual('0xcafe0123');
    });
});
