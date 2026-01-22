# 2.2.0

## Main Changes

1. Added charge expenses (Brazil `despesas de cobrança`) as a new tracked financial component for sub-loans.
2. Charge expenses is a one-time fee imposed when a sub-loan becomes overdue, calculated as: `chargeExpenses = legalPrincipal × chargeExpensesRate`, where `legalPrincipal = trackedPrincipal + trackedPrimaryInterest`.
3. New fields added to structures:
   - `SubLoanTakingRequest`: `chargeExpensesRate`
   - `SubLoanInception`: `initialChargeExpensesRate`
   - `SubLoanState`: `chargeExpensesRate`, `trackedChargeExpenses`, `repaidChargeExpenses`, `discountChargeExpenses`
   - `SubLoanPreview`: same as `SubLoanState`
   - `LoanPreview`: `totalTrackedChargeExpenses`, `totalRepaidChargeExpenses`, `totalDiscountChargeExpenses`
   - `ProcessingSubLoan`: `chargeExpensesRate`, `trackedChargeExpenses`
4. New operation kinds: `ChargeExpensesRateSetting` (value 12), `ChargeExpensesDiscount` (value 19).
5. The value of the following operation kinds have been incremented by 1:
    - `DurationSetting` (value 11) -> `DurationSetting` (value 12);
    - `PrincipalDiscount` (value 12) -> `PrincipalDiscount` (value 13);
    - `PrimaryInterestDiscount` (value 13) -> `PrimaryInterestDiscount` (value 14);
    - `SecondaryInterestDiscount` (value 14) -> `SecondaryInterestDiscount` (value 15);
    - `MoratoryInterestDiscount` (value 15) -> `MoratoryInterestDiscount` (value 16);
    - `LateFeeDiscount` (value 16) -> `LateFeeDiscount` (value 17);
    - `ClawbackFeeDiscount` (value 17) -> `ClawbackFeeDiscount` (value 18).
6. Updated `packedRates` in events to include `chargeExpensesRate` at bits 160-191.
7. Added `packedChargeExpensesParts` parameter to `SubLoanUpdated` event.
8. Repayment/discount sequence updated: charge expenses is repaid after late fee and before clawback fee. The full new sequence is (from the first to the last):
    - Secondary interest;
    - Moratory interest;
    - Late fee;
    - Charge expenses;
    - Clawback fee;
    - Primary interest;
    - Principal.

## Migration

1. Upgrade the already deployed smart contracts to the new version.
2. Update any off-chain code to handle the new fields, event parameters and operation kinds.

# 2.1.1

## Main Change

- Applied custom error naming convention. Errors now follow the `ContractName_SubjectState` pattern.

### Error Renames

**LendingMarketV2:**
- `LendingMarketV2_UnauthorizedCallContext` → `LendingMarketV2_CallContextUnauthorized`
- `LendingMarketV2_SubLoanRapayerAddressZero` → `LendingMarketV2_SubLoanRepayerAddressZero` *(typo fix)*
- `LendingMarketV2_SubLoanUnfrozen` → `LendingMarketV2_SubLoanNotFrozen`

**LendingEngineV2:**
- `LendingEngineV2_UnauthorizedCallContext` → `LendingEngineV2_CallContextUnauthorized`

**CreditLineV2Mock:**
- `CreditLineV2Mock_onAfterLoanClosedReverted` → `CreditLineV2Mock_OnAfterLoanClosedReverted` *(capitalization fix)*

## Migration

No special actions required. Update any off-chain code that catches these errors.

# 2.1.0

## Main Changes.

1.  Rounding approach for the sub-loan fields has changed.
    Tracked, repaid and discount fields are no longer rounded to cents individually, maintaining precise internal values.
    Rounding is now applied only when calculating the outstanding balance by summing all related parts first, then rounding the result.
2.  The number of bits per rate in the packed rates fields of events has been changed from 64 bits per rate to 32 bits per rate.
3.  The clawback fee logic has been added to compensate discounted interest retroactively. The new logic has replaced the grace period logic that used in the previous version.
4.  The remuneratory interest fields have been split into two fields:
    - `primaryInterest` -- the remuneratory interest (tracked, repaid, discount) up to the due date.
    - `secondaryInterest` -- the remuneratory interest (tracked, repaid, discount) post the due date.
5.  The remuneratory rate fields have been split into two fields:
    - `primaryRate` -- the remuneratory rate of the sub-loan that is applied up to the due date.
    - `secondaryRate` -- the remuneratory rate of the sub-loan that is applied post the due date.
6.  The sub-loan parts have been regrouped in storage slots, view structures and event packed fields as follows:
    - principal: `trackedPrincipal`, `repaidPrincipal`, `discountPrincipal`;
    - primary interest: `trackedPrimaryInterest`, `repaidPrimaryInterest`, `discountPrimaryInterest`;
    - secondary interest: `trackedSecondaryInterest`, `repaidSecondaryInterest`, `discountSecondaryInterest`;
    - moratory interest: `trackedMoratoryInterest`, `repaidMoratoryInterest`, `discountMoratoryInterest`;
    - late fee: `trackedLateFee`, `repaidLateFee`, `discountLateFee`;
    - clawback fee: `trackedClawbackFee`, `repaidClawbackFee`, `discountClawbackFee`.
7.  Special discount operations have been introduced:
    - new `OperationKind` values allow discounting specific sub-loan parts (principal, primary/secondary/moratory interest, late fee, clawback fee);
    - special discount amounts may be unrounded (general `Discount` amounts are still financially rounded).
    - new error: `LendingMarketV2_SubLoanDiscountPartExcess`.
8.  The `daysSinceStart` field has been added:
    - to the `SubLoanPreview` structure;
    - to the `packedOpIds` field of the `SubLoanUpdated` event (bits 224 to 239, saturated to `uint16`).
    The new field simplifies the analysis of sub-loan histories both through view functions and block database queries.
9.  Some custom errors have been renamed/split e.g.:
    - `LendingMarketV2_OperationValueInvalid` -> `LendingMarketV2_OperationValueExcess` / `LendingMarketV2_OperationValueNonzero`;
    - `LendingMarketV2_SubLoanPrincipalInvalid` -> `LendingMarketV2_LoanPrincipalExcess`;
    - `LendingMarketV2_SubLoanStartTimestampInvalid` -> `LendingMarketV2_LoanStartTimestampInvalid`.
10. The following structures have been updated according to the points above:
    - `SubLoanInception`;
    - `SubLoanState`;
    - `ProcessingSubLoan`;
    - `SubLoanPreview`;
    - `LoanPreview`;
    - `SubLoanTakingRequest`.
11. The `SubLoanTaken` and `SubLoanUpdated` events have been changed according to the points above.
12. The `flag` parameter has been removed from the following view functions as not needed anymore:
    - `getSubLoanPreview()`;
    - `getLoanPreview()`.
13. Storage namespaces have been updated:
    - `erc7201:cloudwalk.storage.LendingMarketV2` (was `erc7201:cloudwalk.storage.LendingMarket`);
    - `erc7201:cloudwalk.storage.CreditLineV2` (was `erc7201:cloudwalk.storage.CreditLine`).
14. A detailed description of the financial logic and the mathematical formulas backed CFv2 protocol have been added to [docs/description.md](./docs/description.md).

## Migration

1. No migration path from CFv1 is currently available.
2. No upgrade path of the previously deployed CFv2 is available. The contracts must be redeployed.
3. For new deployments of CFv2, see [docs/configuration.md](./docs/configuration.md).

# 2.0.0

## Main Changes

1. The new `Capybara Finance V2` (CFv2) lending protocol has been introduced.
2. The new protocol includes the following main smart contracts: lending market (`LendingMarketV2`), credit line (`CreditLineV2`), lending engine (`LendingEngineV2`). The lending engine is not available externally, it is only used by the lending market contract through the delegatecall mechanism.
3. The new protocol reuses the liquidity pool (`LiquidityPool`) smart contract from the `Capybara Finance V1` (CFv1) protocol.
4. See protocol details in [docs/description.md](./docs/description.md).

## Migration

1. No migration path from CFv1 is currently available.
2. For new deployments of CFv2, see [docs/configuration.md](./docs/configuration.md).
