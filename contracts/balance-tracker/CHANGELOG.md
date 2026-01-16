# Unreleased

## Main Changes

- Applied custom error naming convention. Errors now follow the `ContractName_SubjectState` pattern.

### Error Renames

**BalanceTracker:**
- `FromDayPriorInitDay` → `BalanceTracker_FromDayPriorInitDay`
- `ToDayPriorFromDay` → `BalanceTracker_ToDayPriorFromDay`
- `SafeCastOverflowUint16` → `BalanceTracker_SafeCastOverflowUint16`
- `SafeCastOverflowUint240` → `BalanceTracker_SafeCastOverflowUint240`
- `UnauthorizedCaller` → `BalanceTracker_CallerUnauthorized`

**HarnessAdministrable:**
- `UnauthorizedHarnessAdmin` → `HarnessAdministrable_UnauthorizedAdmin`

## Migration

No special actions required. Update any off-chain code that catches these errors.
