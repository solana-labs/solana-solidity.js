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

3. Compile the Solidity contract. For example, given the popular [ERC20](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol) contract:

```
solang ERC20.sol --target solana -v
```

This outputs `*.abi` and `bundle.so` files.

4. Deploy and interact with the contract on Solana!

```typescript
import { Contract, Program, newAccountWithLamports } from 'solana-solidity';
import CONTRACT_ABI from './ERC20.abi';
import PROGRAM_SO from './bundle.so'; // e.g. via webpack raw-loader

(async function () {
  const connection: Connection = new Connection(
    'http://localhost:8899',
    'confirmed'
  );
  const payerAccount = newAccountWithLamports();
  const program = await Program.deploy(connection, payerAccount, PROGRAM_SO);

  // deploy new contract
  const contractName = 'ERC20';
  const contractAbi = CONTRACT_ABI;
  const constructorArgs = [args...];

  const token = await Contract.deploy(
    program,
    contractName,
    contractAbi,
    constructorArgs,
  );
  console.log(await token.functions.symbol());

  // load an existing contract
  const token2 = await Contract.get(
    program,
    token.getStorageKeyPair(),
    CONTRACT_ABI
  );

  // subscribe to events
  token2.on('Approve', (owner: string, spender: string, value: string) => {
    console.log({
      owner,
      spender,
      value: : ethers.utils.formatEther(value),
    });
  });
})();
```

## Test

### Unit tests:

```
make test-unit
```

### Integration

```
make test-all-examples
```

## Licence

Apache License 2.0
