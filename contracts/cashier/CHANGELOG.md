# Unreleased

## Main Changes

- Applied custom error naming convention. Errors now follow the `ContractName_SubjectState` pattern.

### Error Renames

**Cashier:**
- `Cashier_TxIdZero` → `Cashier_TransactionIdZero`
- `Cashier_HookCallableContractAddressNonZero` → `Cashier_HookCallableContractAddressNonzero`

**CashierShard:**
- `CashierShard_Unauthorized` → `CashierShard_CallerUnauthorized`

## Migration

No special actions required. Update any off-chain code that catches these errors.
