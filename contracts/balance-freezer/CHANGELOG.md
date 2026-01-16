# Unreleased

## Main Changes

- Applied custom error naming convention. Errors now follow the `ContractName_SubjectState` pattern.

### Error Renames

**BalanceFreezer:**
- `BalanceFreezer_TxIdZero` → `BalanceFreezer_TransactionIdZero`

## Migration

No special actions required. Update any off-chain code that catches this error.
