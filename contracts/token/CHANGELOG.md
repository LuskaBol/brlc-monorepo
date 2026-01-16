# Unreleased

## Main Changes

- Applied custom error naming convention across all contracts. Errors now follow the `ContractName_SubjectState` pattern for better identification in block explorers.

### Error Renames

**ERC20Base:**
- `ZeroAddress` → `ERC20Base_AddressZero`
- `ZeroAmount` → `ERC20Base_AmountZero`

**ERC20Freezable:**
- `FreezingNotApproved` → `ERC20Freezable_FreezingUnapproved`
- `FreezingAlreadyApproved` → `ERC20Freezable_FreezingAlreadyApproved`
- `LackOfFrozenBalance` → `ERC20Freezable_FrozenBalanceInsufficient`
- `TransferExceededFrozenAmount` → `ERC20Freezable_FrozenAmountExcess`
- `UnauthorizedFreezer` → `ERC20Freezable_FreezerUnauthorized`
- `ContractBalanceFreezingAttempt` → `ERC20Freezable_ContractBalanceFreezingAttempt`

**ERC20Mintable:**
- `ZeroMintAmount` → `ERC20Mintable_MintAmountZero`
- `ZeroBurnAmount` → `ERC20Mintable_BurnAmountZero`
- `ZeroPremintAmount` → `ERC20Mintable_PremintAmountZero`
- `TransferExceededPremintedAmount` → `ERC20Mintable_PremintedAmountExcess`
- `MaxPendingPremintsCountAlreadyConfigured` → `ERC20Mintable_MaxPendingPremintsCountAlreadyConfigured`
- `MaxPendingPremintsLimitReached` → `ERC20Mintable_MaxPendingPremintsLimitReached`
- `PremintReleaseTimePassed` → `ERC20Mintable_PremintReleaseTimePassed`
- `PremintReschedulingAlreadyConfigured` → `ERC20Mintable_PremintReschedulingAlreadyConfigured`
- `PremintReschedulingTimePassed` → `ERC20Mintable_PremintReschedulingTimePassed`
- `PremintReschedulingChain` → `ERC20Mintable_PremintReschedulingChain`
- `PremintNonExistent` → `ERC20Mintable_PremintNonexistent`
- `PremintInsufficientAmount` → `ERC20Mintable_PremintAmountInsufficient`
- `PremintUnchanged` → `ERC20Mintable_PremintUnchanged`
- `InappropriateUint64Value` → `ERC20Mintable_Uint64ValueExcess`
- `InsufficientReserveSupply` → `ERC20Mintable_ReserveSupplyInsufficient`

**ERC20HookMock:**
- `TestBeforeTokenTransferHookError` → `ERC20HookMock_BeforeTokenTransferHookError`
- `TestAfterTokenTransferHookError` → `ERC20HookMock_AfterTokenTransferHookError`

### Structural Changes

- Moved error definitions from implementation contracts to interface files (`IERC20Base.sol`, `IERC20Freezable.sol`, `IERC20Mintable.sol`).
- Created new `IERC20BaseErrors` interface in `IERC20Base.sol`.

## Migration

No special actions required. Update any off-chain code that catches these errors.
