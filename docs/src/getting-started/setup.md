# Setup

This is a short guide into deploying and interacting with the standard `ERC20.sol` Solidity contract:

1. Install the [Solang Compiler](https://solang.readthedocs.io/en/latest/).

2. Compile the Solidity contract:

```
solang ERC20.sol --target solana -v
```

This will output a `ERC20.abi` and `bundle.so` files.

3. Start the [Solana Test Validator](https://docs.solana.com/developing/test-validator).

```bash
solana-test-validator
```

4. Install the library:

```
npm install solana-solidity
```

5. Deploy and interact with the contract on Solana!

```typescript
import { Contract, Program, newAccountWithLamports } from 'solana-solidity';
import ERC20_CONTRACT_ABI from './ERC20.abi';
import PROGRAM_SO from './bundle.so'; // e.g. via webpack raw-loader

(async function () {
  const connection: Connection = new Connection(
    'http://localhost:8899',
    'recent'
  );
  const payerAccount = newAccountWithLamports();
  const program = await Program.deploy(connection, payerAccount, PROGRAM_SO);

  // deploy new contract
  const token = await Contract.deploy(
    program,
    'ERC20',
    ERC20_CONTRACT_ABI,
    [NAME, SYMBOL, TOTAL_SUPPLY],
    [],
    8192 * 8
  );
  console.log(await token.functions.symbol());

  // load existing contract
  const token2 = await Contract.get(
    program,
    token.getStorageKeyPair(),
    ERC20_CONTRACT_ABI
  );

  // subscribe to events
  const spender = '0x...';
  const event = token2.event('Approve', spender);
  token2.on(event, (owner: string, spender: string, value: string) => {
    console.log({
      owner,
      spender,
      value: : ethers.utils.formatEther(value),
    });
  });
})();
```

This outputs `*.abi` and `bundle.so` files.

Minimum version requirements

| Build tool | Version |
| :--------- | :------ |
| Node.js    | v14.0.0 |
