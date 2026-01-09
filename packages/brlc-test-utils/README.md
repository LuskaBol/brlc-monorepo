# @cloudwalk/brlc-test-utils

Shared test utilities for BRLC smart contracts.

## Installation

This package is part of the monorepo and is automatically linked via pnpm workspaces.

Add to your contract's `package.json`:

```json
{
  "devDependencies": {
    "@cloudwalk/brlc-test-utils": "workspace:"
  }
}
```

## Usage

Import utilities in your test files:

```typescript
import {
  setUpFixture,
  proveTx,
  connect,
  checkEquality,
} from "@cloudwalk/brlc-test-utils";
```

Or import from specific modules:

```typescript
import { setUpFixture, checkEquality } from "@cloudwalk/brlc-test-utils";
import { proveTx, connect, getAddress } from "@cloudwalk/brlc-test-utils";
import { checkEventField } from "@cloudwalk/brlc-test-utils/checkers";
```

## Available Utilities

### Common (`/common`)

- `setUpFixture<T>(func)` - Sets up test fixtures with Hardhat snapshot support
- `checkEquality(actual, expected, index?, props?)` - Compare objects for equality
- `resultToObject(result)` - Convert contract result to plain object
- `maxUintForBits(numberOfBits)` - Get max uint value for bit count
- `createRevertMessageDueToMissingRole(account, role)` - Create access control error message

### Ethereum (`/eth`)

- `proveTx(txPromise)` - Wait for transaction and return receipt
- `connect(contract, signer)` - Connect contract to signer
- `getAddress(contract)` - Get address string from contract
- `getTxTimestamp(tx)` - Get timestamp of a transaction
- `getBlockTimestamp(blockTag)` - Get timestamp of a block
- `getLatestBlockTimestamp()` - Get current block timestamp
- `increaseBlockTimestampTo(target)` - Advance time to target
- `increaseBlockTimestamp(seconds)` - Advance time by seconds
- `getNumberOfEvents(tx, contract, eventName)` - Count events in transaction
- `checkContractUupsUpgrading(contract, factory, sig?)` - Test UUPS upgrades
- `checkTokenPath(tx, tokenContract, path)` - Verify token transfer path

### Checkers (`/checkers`)

- `checkEventParameter(fieldName, expected, options?)` - Create event field checker
- `checkEventField` - Alias for checkEventParameter
- `checkEventParameterNotEqual(fieldName, notExpected, options?)` - Create negative event field checker
- `checkEventFieldNotEqual` - Alias for checkEventParameterNotEqual
