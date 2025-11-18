## Main Changes

- Replaced ERC20 approval-based spending model with recipient limits and allowlist system.
  - Breaking change: Removed `approve()` and `clearAllApprovals()` functions.
  - Breaking change: Removed `approvedSpenders()` view function.
  - Breaking change: Removed `MANAGER_ROLE` — both `withdraw()` and `withdrawTo()` now require `WITHDRAWER_ROLE`.

- Added recipient limits enforcement with configurable policy:
  - `setRecipientLimit(address recipient, uint256 limit)` — Configure withdrawal limits per recipient (owner-only).
  - `setRecipientLimitPolicy(RecipientLimitPolicy policy)` — Set the enforcement policy (owner-only).
  - Introduced `RecipientLimitPolicy` enum with two values:
    - `Disabled` (0) — No limit checks performed. Any address can receive funds.
    - `EnforceAll` (1) — Full enforcement. Only allowlisted recipients can receive funds with limit checks.

- Updated events to track recipient limit changes:
  - `UnderlyingTokenSet(address indexed token)` — Emitted when the underlying token is set during initialization.
  - `RecipientLimitUpdated(address indexed recipient, uint256 oldLimit, uint256 newLimit)` — Emitted when a recipient's limit is updated.
  - `RecipientLimitPolicyUpdated(RecipientLimitPolicy indexed policy)` — Emitted when the enforcement policy is changed.

- Added view functions to inspect recipient limits:
  - `getRecipientLimits() → RecipientLimitView[]` — Returns all configured recipients and their limits as an array of structs.
  - `recipientLimitPolicy() → RecipientLimitPolicy` — Returns the current enforcement policy.

- Updated custom errors:
  - Added `Treasury_InsufficientRecipientLimit(address recipient, uint256 requested, uint256 available)` — Prevents withdrawals exceeding recipient limits.
  - Replaced `Treasury_SpenderAddressZero` with `Treasury_RecipientAddressZero`.

- Storage changes:
  - Renamed storage field `token` to `underlyingToken`.
  - Replaced `EnumerableSet.AddressSet approvedSpenders` with `EnumerableMap.AddressToUintMap recipientLimits`.
  - Added `recipientLimitPolicy` field to storage for enforcement policy tracking.

## Recipient Limits Behavior

### When Policy is EnforceAll (default)
- Only recipients with configured limits can receive funds (allowlist enforcement).
- Recipients not in the map are treated as having a 0 limit and cannot receive funds.
- Each withdrawal decrements the recipient's limit.
- Recipients remain in the map even when their limit reaches 0 after withdrawals.
- Setting limit to 0 explicitly removes the recipient from the allowed list.
- Recipients with `type(uint256).max` have unlimited withdrawals (limit is not decremented).

### When Policy is Disabled
- Withdrawals can be made to any address without checks.
- Recipient limits are NOT decremented.
- Configured limits are preserved and can be re-enforced by switching policy back to `EnforceAll`.

# 1.0.0

## Overview

The Treasury contract is a secure, upgradeable vault for a single ERC20 token with controlled spending rules and role-based access control. It allows designated withdrawers to withdraw tokens directly and approved spenders to transfer tokens via ERC20 allowances. The contract is designed to manage only one token type per deployment, ensuring focused and predictable token operations.

## Functions

### Transactional Functions

#### `withdraw(uint256 amount)`
- **Purpose**: Withdraws tokens to the caller's address
- **Access**: WITHDRAWER_ROLE required
- **Intended Usage**: Designed for smart contracts that need programmatic access to treasury funds. Grant WITHDRAWER_ROLE to smart contracts that require automated token withdrawals to their own addresses
- **Parameters**:
  - `amount`: Amount of tokens to withdraw
- **Events**: Emits `Withdrawal` event

#### `withdrawTo(address to, uint256 amount)`
- **Purpose**: Withdraws tokens to a specified address
- **Access**: MANAGER_ROLE required
- **Intended Usage**: Designed for human managers and administrative operations. Managers with MANAGER_ROLE can withdraw tokens to any destination address for treasury management and distribution purposes
- **Parameters**:
  - `to`: Destination address for tokens
  - `amount`: Amount of tokens to withdraw
- **Events**: Emits `Withdrawal` event

#### `approve(address spender, uint256 amount)`
- **Purpose**: Approves a spender to use ERC20 transferFrom on treasury tokens
- **Access**: OWNER_ROLE required
- **Parameters**:
  - `spender`: Address to approve as spender
  - `amount`: Amount of tokens to approve
- **Effects**: Adds spender to approved spenders set, calls ERC20 approve

#### `clearAllApprovals()`
- **Purpose**: Revokes all ERC20 allowances for all approved spenders
- **Access**: OWNER_ROLE required
- **Effects**: Sets all allowances to zero, clears approved spenders set

### View Functions

#### `approvedSpenders()`
- **Purpose**: Returns array of all approved spender addresses
- **Access**: Public view
- **Returns**: `address[]` - Array of approved spender addresses

#### `underlyingToken()`
- **Purpose**: Returns the address of the managed ERC20 token
- **Access**: Public view
- **Returns**: `address` - Token contract address

## Events

### `Withdrawal(address indexed to, address indexed withdrawer, uint256 amount)`
- **Emitted by**: `withdraw()` and `withdrawTo()` functions
- **Purpose**: Logs token withdrawal operations
- **Parameters**:
  - `to`: Address that received the tokens (indexed)
  - `withdrawer`: Address that initiated the withdrawal (indexed)
  - `amount`: Amount of tokens withdrawn

## Roles

### Treasury-Specific Roles

#### `WITHDRAWER_ROLE`
- **Purpose**: Allows withdrawing tokens to caller's own address
- **Functions**: `withdraw()`
- **Admin Role**: GRANTOR_ROLE
- **Intended Recipients**: Smart contracts that need programmatic access to treasury funds

#### `MANAGER_ROLE`
- **Purpose**: Allows withdrawing tokens to any specified address
- **Functions**: `withdrawTo()`
- **Admin Role**: GRANTOR_ROLE
- **Intended Recipients**: Human managers and administrative accounts for treasury operations
