# Setup

1. Install the [Solang Compiler](https://solang.readthedocs.io/en/latest/).
2. Install the library:

```
npm install solana-solidity
```

3. Compile the Solidity contract:

```
solang MyContract.sol --target solana -v
```

This outputs `*.abi` and `bundle.so` files.

Minimum version requirements

| Build tool | Version |
| :--------- | :------ |
| Node.js    | v14.0.0 |
