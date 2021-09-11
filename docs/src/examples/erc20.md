# ERC20

This example assumes all [prerequisites](../getting-started/installation.md) are installed.

1. Clone the Repo.

```bash
git clone https://github.com/solana-labs/solana-solidity.js
```

2. Compile the example contracts.

```bash
npm run build-examples
```

3. Change directories to the [example](https://github.com/solana-labs/solana-solidity.js/tree/master/examples/erc20).

```bash
cd solana-solidity.js/examples/erc20
```

4. Start the [Solana test validator](https://docs.solana.com/developing/test-validator).

```bash
solana-test-validator
```

5. Deploy and interact with the contract on Solana!

```typescript
import { Contract, Program, newAccountWithLamports } from 'solana-solidity';
import ERC20_CONTRACT_ABI from './erc20.abi';
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
