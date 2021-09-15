## Solana Solidity JavaScript Client (Work In Progress)

JavaScript Client to use to deploy and interact with Solang-compiled Solidity contracts. The [Solang Compiler](https://github.com/hyperledger-labs/solang) can compile Solidity contracts to native Solana BPF contracts. Attempts to emulate [ethers.js](https://github.com/ethers-io/ethers.js) and [anchor.js](https://github.com/project-serum/anchor/tree/master/ts)

### Documentation

View docs [here](https://vbstreetz.github.io/solana-solidity.js).

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
import CONTRACT_ABI from './MyContract.abi';
import PROGRAM_SO from './bundle.so'; // e.g. via webpack raw-loader

(async function () {
  const connection: Connection = new Connection(
    'http://localhost:8899',
    'recent'
  );
  const payerAccount = newAccountWithLamports();
  const program = await Program.deploy(connection, payerAccount, PROGRAM_SO);

  // deploy new contract
  const contractName = 'MyContract';
  const contractAbi = CONTRACT_ABI;
  const constructorArgs = [args...];
  const storage = 8192 * 8;
  const seeds = [];
  const token = await Contract.deploy(
    program,
    contractName,
    contractAbi,
    constructorArgs,
    seeds,
    storage
  );
  console.log(await token.functions.symbol());

  // load existing contract
  const token2 = await Contract.get(
    program,
    token.getStorageKeyPair(),
    CONTRACT_ABI
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
