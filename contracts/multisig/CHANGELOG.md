# 1.2.0

## Main Changes

### MultiSigGuardianWallet
- Allow configuring zero guardians to disable the guardian requirement.
- Calling `configureGuardians([], 0)` now disables guardian checks instead of reverting.
- Wallets can be deployed/initialized with no guardians by passing empty array and zero required approvals.
- Removed `MultiSigGuardianWallet_GuardiansArrayEmpty` error (no longer needed).

## Migration

No special actions required. Existing wallets with guardians are unaffected. To disable guardians on an existing wallet, execute `configureGuardians([], 0)` through the multisig.

# 1.1.1

## Main Changes

- Applied custom error naming convention across all contracts. Errors now follow the `ContractName_SubjectState` pattern for better identification in block explorers.

### Error Renames

**MultiSigWallet:**
- `UnauthorizedCaller` → `MultiSigWallet_CallerUnauthorized`
- `TransactionNotExist` → `MultiSigWallet_TransactionNonexistent`
- `TransactionAlreadyExecuted` → `MultiSigWallet_TransactionAlreadyExecuted`
- `TransactionNotApproved` → `MultiSigWallet_TransactionUnapproved`
- `TransactionAlreadyApproved` → `MultiSigWallet_TransactionAlreadyApproved`
- `EmptyOwnersArray` → `MultiSigWallet_OwnersArrayEmpty`
- `ZeroOwnerAddress` → `MultiSigWallet_OwnerAddressZero`
- `DuplicateOwnerAddress` → `MultiSigWallet_OwnerAddressDuplicate`
- `InvalidRequiredApprovals` → `MultiSigWallet_RequiredApprovalsInvalid`
- `NotEnoughApprovals` → `MultiSigWallet_ApprovalsInsufficient`
- `InternalTransactionFailed` → `MultiSigWallet_InternalTransactionFailed`
- `TransactionExpired` → `MultiSigWallet_TransactionExpired`
- `CooldownNotEnded` → `MultiSigWallet_CooldownActive`
- `InvalidExpirationTime` → `MultiSigWallet_ExpirationTimeInvalid`

**TestContractMock:**
- `TestError` → `TestContractMock_TestError`

### Structural Changes

- Moved error definitions from `MultiSigWalletBase.sol` to `IMultiSigWallet.sol` interface.

## Migration

No special actions required. Update any off-chain code that catches these errors.

# 1.1.0

## Main Changes

### MultiSigGuardianWallet
- Added new `MultiSigGuardianWallet` and `MultiSigGuardianWalletUpgradeable` contracts with guardian support.
- Guardians are a designated subset of wallet owners whose participation is mandatory for transaction execution.
- Added `MultiSigGuardianWalletFactory` for deploying non-upgradeable guardian wallets.

### MultiSigWallet
- Added `_beforeExecute()` and `_afterConfigureOwners()` hooks for extensibility.

# 1.0.0

## Main Changes

### MultiSigWalle

- Implemented `IVersionable` interface from `@cloudwalk/brlc-base` in `MultiSigWalletBase`, adding the `$__VERSION()` function that returns version `1.0.0` for both `MultiSigWallet` and `MultiSigWalletUpgradeable` contracts.
