# Introduction

[Solana-Solidity.js](https://github.com/solana-labs/solana-solidity.js) is a JavaScript Client that can be used to deploy and interact with Solang-compiled Solidity contracts. The [Solang Compiler](https://github.com/hyperledger-labs/solang) can compile Solidity contracts to native Solana BPF contracts. Attempts to emulate [ethers.js](https://github.com/ethers-io/ethers.js) and [anchor.js](https://github.com/project-serum/anchor/tree/master/ts) APIs.

Features:

- Upload a BPF program
- Interact with an existing on-chain program
- Call a constructor of a solidity contract
- Call a function of a solidity contract
- Properly decode errors
- Subscribe to events
