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

2. Pull the Docker images to compile and deploy your contracts:

```shell
yarn docker
```

3. Start the Solana test validator:

```shell
yarn validator
```

4. In a new terminal window, initialize a project:

```shell
mkdir -p project/contracts project/build
cd project
curl -o contracts/ERC20.sol \
     https://raw.githubusercontent.com/solana-labs/solana-solidity.js/master/test/examples/erc20/contracts/ERC20.sol
```

5. Compile the Solidity contract:

```shell
docker run --rm -it -v $PWD:/project --entrypoint /bin/bash \
       ghcr.io/hyperledger-labs/solang -c \
       "solang /project/contracts/ERC20.sol -o /project/build --target solana -v"
```

This outputs `ERC20.abi` and `bundle.so` files to the `build` directory.

6. Install the library:

```shell
yarn add @solana/solidity

# OR

npm install @solana/solidity
```

7. Create a script file to run:

```shell
touch erc20.js
```

8. Paste this code in the file and save it:

```js
const { Connection, LAMPORTS_PER_SOL, Keypair } = require('@solana/web3.js');
const { Contract, publicKeyToHex } = require('@solana/solidity');
const { readFileSync } = require('fs');

const ERC20_ABI = JSON.parse(readFileSync('./build/ERC20.abi', 'utf8'));
const BUNDLE_SO = readFileSync('./build/bundle.so');

(async function () {
    console.log('Connecting to your local Solana node ...');
    const connection = new Connection('http://localhost:8899', 'confirmed');

    const payer = Keypair.generate();
    while (true) {
        console.log('Airdropping SOL to a new wallet ...');
        await connection.requestAirdrop(payer.publicKey, 1 * LAMPORTS_PER_SOL);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (await connection.getBalance(payer.publicKey)) break;
    }

    const address = publicKeyToHex(payer.publicKey);
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
        4096 * 8
    );

    console.log('Contract deployment finished, invoking some contract functions ...');
    const symbol = await contract.symbol();
    const balance = await contract.balanceOf(address);

    console.log(`ERC20 contract for ${symbol} deployed!`);
    console.log(`Your wallet at ${address} has a balance of ${balance} tokens.`);

    contract.addEventListener(function (event) {
        console.log(`${event.name} event emitted!`);
        console.log(`${event.args[0]} sent ${event.args[2]} tokens to ${event.args[1]}`);
    });

    console.log('Sending tokens will emit a "Transfer" event ...');
    const recipient = Keypair.generate();
    await contract.transfer(publicKeyToHex(recipient.publicKey), '1000000000000000000');

    process.exit(0);
})();
```

9. Run the script to deploy and interact with your contract on Solana!

```
node erc20.js
```

## Build from source

1. Clone the project:

```shell
git clone https://github.com/solana-labs/solana-solidity.js.git
cd solana-solidity.js
```

2. Install the dependencies:

```shell
yarn install
```

3. Compile the library from TypeScript to JavaScript:

```shell
yarn build
```

4. Pull the Docker images to build and run the tests:

```shell
yarn docker
```

5. Start the test validator:

```shell
yarn validator
```

6. In another terminal window, build and run the tests:

```shell
yarn build:test
yarn test
```
