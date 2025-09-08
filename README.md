# SharedWalletController

<p align="center">
  <img src="./docs/media/brlc-cover.png">
</p>

[![codecov](https://codecov.io/gh/cloudwalk/brlc-shared-wallet-controller/branch/main/graph/badge.svg)](https://codecov.io/gh/cloudwalk/brlc-shared-wallet-controller)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![example branch parameter](https://github.com/cloudwalk/brlc-shared-wallet-controller/actions/workflows/build.yml/badge.svg?branch=main)
![example branch parameter](https://github.com/cloudwalk/brlc-shared-wallet-controller/actions/workflows/test.yml/badge.svg?branch=main)

This repository contains SharedWalletController smart contracts.
The SharedWalletController smart contract manages shared wallets and integrates them with ERC20 tokens through hooks.

## Project Setup

1. Clone the repo.
2. Create the `.env` file based on the `.env.example` one:
   * Windows:
    ```sh
    copy .env.example .env
    ```
   * MacOS/Linux:
    ```sh
    cp .env.example .env
    ```
3. Optionally update the settings in the newly created `.env` file (e.g., Solidity version, number of optimization runs, network RPC URLs, private keys (PK) for networks, etc.).

## Build and test

```sh
# Install all dependencies
npm install

# Compile all contracts
npx hardhat compile

# Run all tests
npx hardhat test
```

## Licensing

This project is released under the MIT License, see [LICENSE](./LICENSE).
