# BRLC Monorepo

![brlc-cover](./docs/media/brlc-cover.png)

This repository all smart contracts and utilities for smart contracts development

## Content

1. Common Development [documentation](./docs/DEVELOPMENT.md)
1. JS packages:
   - Package with [Prettier configuration](./packages/pretier-config)
   - Package with [Eslint configuration](./packages/eslint-config)
   - [@cloudwalk/chainshot](./packages/chainshot/README.md) library

| Component                 | Coverage                                                                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset Transit Desk        | [![codecov](https://codecov.io/github/cloudwalk/brlc-monorepo/branch/main/graph/badge.svg?component=contract-asset-transit-desk)](https://app.codecov.io/gh/cloudwalk/brlc-monorepo)        |
| Balance Freezer           | [![codecov](https://codecov.io/github/cloudwalk/brlc-monorepo/branch/main/graph/badge.svg?component=contract-balance-freezer)](https://app.codecov.io/gh/cloudwalk/brlc-monorepo)           |
| Balance Tracker           | [![codecov](https://codecov.io/github/cloudwalk/brlc-monorepo/branch/main/graph/badge.svg?component=contract-balance-tracker)](https://app.codecov.io/gh/cloudwalk/brlc-monorepo)           |
| Blueprint                 | [![codecov](https://codecov.io/github/cloudwalk/brlc-monorepo/branch/main/graph/badge.svg?component=contract-blueprint)](https://app.codecov.io/gh/cloudwalk/brlc-monorepo)                 |
| Capybara Finance          | [![codecov](https://codecov.io/github/cloudwalk/brlc-monorepo/branch/main/graph/badge.svg?component=contract-capybara-finance)](https://app.codecov.io/gh/cloudwalk/brlc-monorepo)          |
| Capybara Finance V2       | [![codecov](https://codecov.io/github/cloudwalk/brlc-monorepo/branch/main/graph/badge.svg?component=contract-capybara-finance-v2)](https://app.codecov.io/gh/cloudwalk/brlc-monorepo)       |
| Card Payment Processor    | [![codecov](https://codecov.io/github/cloudwalk/brlc-monorepo/branch/main/graph/badge.svg?component=contract-card-payment-processor)](https://app.codecov.io/gh/cloudwalk/brlc-monorepo)    |
| Card Payment Processor V2 | [![codecov](https://codecov.io/github/cloudwalk/brlc-monorepo/branch/main/graph/badge.svg?component=contract-card-payment-processor-v2)](https://app.codecov.io/gh/cloudwalk/brlc-monorepo) |
| Cashier                   | [![codecov](https://codecov.io/github/cloudwalk/brlc-monorepo/branch/main/graph/badge.svg?component=contract-cashier)](https://app.codecov.io/gh/cloudwalk/brlc-monorepo)                   |
| Credit Agent              | [![codecov](https://codecov.io/github/cloudwalk/brlc-monorepo/branch/main/graph/badge.svg?component=contract-credit-agent)](https://app.codecov.io/gh/cloudwalk/brlc-monorepo)              |
| Multisig                  | [![codecov](https://codecov.io/github/cloudwalk/brlc-monorepo/branch/main/graph/badge.svg?component=contract-multisig)](https://app.codecov.io/gh/cloudwalk/brlc-monorepo)                  |
| Net Yield Distributor     | [![codecov](https://codecov.io/github/cloudwalk/brlc-monorepo/branch/main/graph/badge.svg?component=contract-net-yield-distributor)](https://app.codecov.io/gh/cloudwalk/brlc-monorepo)     |
| Periphery                 | [![codecov](https://codecov.io/github/cloudwalk/brlc-monorepo/branch/main/graph/badge.svg?component=contract-periphery)](https://app.codecov.io/gh/cloudwalk/brlc-monorepo)                 |
| Shared Wallet Controller  | [![codecov](https://codecov.io/github/cloudwalk/brlc-monorepo/branch/main/graph/badge.svg?component=contract-shared-wallet-controller)](https://app.codecov.io/gh/cloudwalk/brlc-monorepo)  |
| Token                     | [![codecov](https://codecov.io/github/cloudwalk/brlc-monorepo/branch/main/graph/badge.svg?component=contract-token)](https://app.codecov.io/gh/cloudwalk/brlc-monorepo)                     |
| Treasury                  | [![codecov](https://codecov.io/github/cloudwalk/brlc-monorepo/branch/main/graph/badge.svg?component=contract-treasury)](https://app.codecov.io/gh/cloudwalk/brlc-monorepo)                  |

### Monorepo

#### Tasks

- [x] Setup components codecov
- [x] Setup common precommit hooks and linting
- [x] Create CI to sync contracts from monorepo to legacy repos
- [x] Create CI to use in monorepo instead
- [x] Backstage files
- [x] Rename repository
- [ ] Fix typescript
- [ ] Add ts checker to CI
- [ ] fix eslint
- [ ] Add eslint to CI

#### Monorepo migration roadmap

- [x] Move all contracts to the monorepo
- [ ] Configure github repo with right permissions and rules
- [ ] Change readmes to use monorepo links
  - Codecov badges to use component name
  - Project setup documentation to use monorepo links
  - License to use monorepo links
- [ ] Migrate Stratus to the monorepo contracts
- [ ] Join contracts by workspace and cross-reference contracts
- [ ] Extract common contracts to a separate packages
- [ ] Use workspace defined versions for dependencies (hardhat, openzeppelin, etc.)
