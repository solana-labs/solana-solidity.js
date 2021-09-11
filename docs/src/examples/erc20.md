# ERC20

This example assumes all [prerequisites](../getting-started/installation.md) are installed.

1. Clone the repo.

```bash
git clone https://github.com/solana-labs/solana-solidity.js
```

2. Compile the contract.

```bash
solang examples/erc20/contracts/ERC20.sol -o examples/erc20/build --target solana -v
```

3. Start the [Solana test validator](https://docs.solana.com/developing/test-validator).

```bash
solana-test-validator
```

4. Run the test

```
mocha -r ts-node/register examples/erc20/tests/erc20.spec.ts
```
