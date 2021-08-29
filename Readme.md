## Solana Solidity JavaScript Client (Work In Progress)

JavaScript Client to use to deploy and interact with Solang-compiled Solidity contracts. The [Solang Compiler](https://github.com/hyperledger-labs/solang) can compile Solidity contracts to native Solana BPF contracts. Attempts to emulate [ethers.js](https://github.com/ethers-io/ethers.js) and [anchor.js](https://github.com/project-serum/anchor/tree/master/ts)

### Getting started

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

4. Deploy and interact with the contract on Solana!

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
  console.log(await token.call('symbol', []));

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

## Licence

Apache License 2.0
