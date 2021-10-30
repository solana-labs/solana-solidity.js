# `@solana/solidity`

The [Solang Compiler](https://github.com/hyperledger-labs/solang) compiles Solidity contracts to native Solana BPF programs.

This TypeScript library, inspired by [Ethers.js](https://github.com/ethers-io/ethers.js), can deploy and interact with Solidity contracts on Solana.

## Features

- Compile, load, and deploy Solidity contracts
- Redeploy and reuse existing contract programs
- Call contract functions to read and write data
- Subscribe to contract events and program logs

## Quick Setup

This is a short guide to deploying and interacting with the standard [ERC20](https://docs.openzeppelin.com/contracts/api/token/erc20) Solidity contract on Solana.

1. Install [Docker](https://docker.com) and [Node.js](https://nodejs.org) (version 14 or higher).

2. Pull the required images:

```shell
docker pull solanalabs/solana:edge
docker pull ghcr.io/hyperledger-labs/solang:latest
```

3. Start the test validator:

```shell
docker run --rm -it -p 8899:8899 -p 8900:8900 solanalabs/solana:edge > /dev/null
```

4. Open a second terminal window, and initialize the project:

```shell
mkdir -p project/contracts project/build
cd project
curl -o contracts/ERC20.sol \
     https://raw.githubusercontent.com/solana-labs/solana-solidity.js/master/examples/erc20/contracts/ERC20.sol
```

5. Compile the Solidity contract:

```shell
docker run --rm -it -v $PWD:/project --entrypoint /bin/bash \
       ghcr.io/hyperledger-labs/solang -c \
       "solang /project/contracts/ERC20.sol -o /project/build --target solana -v"
```

This outputs `ERC20.abi` and `bundle.so` files to the `build` folder.

6. Install the library:

```shell
yarn add @solana/solidity

# OR

npm install @solana/solidity
```

6. Create a script file to run:

```shell
touch erc20.js
```

7. Paste this code in the file:

```js
const { Connection, LAMPORTS_PER_SOL, Keypair } = require('@solana/web3.js');
const { Contract, pubKeyToHex } = require('@solana/solidity');
const { readFileSync } = require('fs');

const ERC20_ABI = JSON.parse(readFileSync('./build/ERC20.abi', 'utf8'));
const BUNDLE_SO = readFileSync('./build/bundle.so');

(async function () {
    console.log('Connecting to your local Solana node ...');
    const connection = new Connection('http://localhost:8899', 'confirmed');

    console.log('Generating a new wallet and airdropping SOL to it ...');
    const payer = Keypair.generate();
    await connection.requestAirdrop(payer.publicKey, 1 * LAMPORTS_PER_SOL);

    console.log('Sleeping for a second ...');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const address = pubKeyToHex(payer.publicKey);
    const program = Keypair.generate();
    const storage = Keypair.generate();

    const contract = new Contract(
        connection,
        program.publicKey,
        storage.publicKey,
        ERC20_ABI,
        payer
    );

    console.log('Deploying the Solang-compiled ERC20 program ...');
    await contract.load(program, BUNDLE_SO);

    console.log('Program deployment finished, deploying the ERC20 contract ...');
    await contract.deploy(
        'ERC20',
        ['Solana', 'SOL', '1000000000000000000'],
        program,
        storage,
        8192 * 8
    );

    console.log('Contract deployment finished, invoking some contract functions ...');
    const symbol = await contract.symbol();
    const balance = await contract.balanceOf(address);

    console.log(`ERC20 contract for ${symbol} deployed!`);
    console.log(`Your wallet at ${address} has a balance of ${balance} tokens.`);
})();
```

8. Deploy and interact with your contract on Solana!

```
node erc20.js
```

## Build from source

```shell
git clone https://github.com/solana-labs/solana-solidity.js.git
cd solana-solidity.js

yarn
yarn build
```

## Test

Unit tests:

```shell
make test-unit
```

Integration tests:

```shell
make test-all-examples
make test-example o=errors # run the tests for a single example
```

