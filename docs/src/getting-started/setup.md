# Setup

This is a short guide into deploying and interacting with the standard [ERC20](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol) Solidity contract on Solana:

1. Install [docker](https://www.docker.com/).
2. Pull the required images:

```
docker pull solanalabs/solana:edge
docker pull hyperledgerlabs/solang:latest
```

3. Start the test validator:

```
docker run --rm -it -p 8899:8899 -p 8900:8900 solanalabs/solana:edge > /dev/null
```

4. In a new tab, initialize your project:

```
mkdir -p project/contracts project/build
cd project
curl -o contracts/ERC20.sol https://raw.githubusercontent.com/vbstreetz/solana-solidity.js/master/examples/erc20/contracts/ERC20.sol
```

5. Compile the Solidity contract:

```
docker run --rm -it -v $PWD:/project --entrypoint /bin/bash hyperledgerlabs/solang -c "solang /project/contracts/ERC20.sol -o /project/build --target solana -v"
```

This outputs `*.abi` and `bundle.so` files in a `build` folder.

6. Install the library:

```
npm install solana-solidity
```

7. Paste the following in a `example.js` file:

```js
const { Connection, Keypair } = require('@solana/web3.js');
const { Program } = require('solana-solidity');
const fs = require('fs');

const CONTRACT_ABI = fs.readFileSync('./build/ERC20.abi', 'utf8');
const PROGRAM_SO = fs.readFileSync('./build/bundle.so');

main().then(
  () => {
    process.exit();
  },
  (err) => {
    console.log(err);
    process.exit(-1);
  }
);

async function main() {
  console.log('connecting to the local solana node');
  const connection = new Connection('http://localhost:8899', 'confirmed');
  const payerAccount = await newAccountWithLamports(connection);

  // load program
  console.log('deploying the solang program');
  const program = await Program.deploy(connection, payerAccount, PROGRAM_SO);

  // deploy new contract
  console.log('deploying the erc20 contract to the program');
  const contractName = 'ERC20';
  const contractAbi = CONTRACT_ABI;
  const constructorArgs = ['Solana', 'SOL', 10000];
  const { contract: token } = await program.deployContract({
    name,
    abi,
    space: 8192 * 8,
    constructorArgs,
  });

  // call a function
  console.log('invoking a contract call');
  const { result } = await token.functions.symbol();
  console.log('result: %s', result);

  console.log('success!');
}

async function newAccountWithLamports(
  connection: Connection,
  lamports: number = 10000000000
): Promise<Keypair> {
  const account = Keypair.generate();

  let retries = 10;
  await connection.requestAirdrop(account.publicKey, lamports);
  for (;;) {
    await sleep(500);
    if (lamports == (await connection.getBalance(account.publicKey))) {
      return account;
    }
    if (--retries <= 0) {
      break;
    }
    // console.log('airdrop retry ' + retries);
  }
  throw new Error(`airdrop of ${lamports} failed`);
}

function sleep(ms: number) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}
```

8. Deploy and interact with the contract on Solana!

```
node example.js
```

## Test

Unit tests:

```
make test-unit
```

Integration(run tests in the examples):

```
make test-all-examples
make test-example o=errors # single
```

## Minimum version requirements

| Build tool | Version |
| :--------- | :------ |
| Node.js    | v14.0.0 |
