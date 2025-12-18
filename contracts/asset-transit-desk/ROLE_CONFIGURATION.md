# AssetTransitDesk - Role Configuration Guide

This document shows all roles needed to configure the `AssetTransitDesk` contract and its interactions with external contracts.

---

## 1. Internal Roles (AssetTransitDesk Contract)

Roles and functions defined in the `AssetTransitDesk` contract.

### 1.1 Role Definitions

All roles in the contract, their admin roles, and whether they are inherited or contract-specific.

| Role Name | Admin Role | Type |
|-----------|------------|------|
| `OWNER_ROLE` | Self-administered | Inherited |
| `GRANTOR_ROLE` | `OWNER_ROLE` | Inherited |
| `RESCUER_ROLE` | `GRANTOR_ROLE` | Inherited |
| `PAUSER_ROLE` | `GRANTOR_ROLE` | Inherited |
| `MANAGER_ROLE` | `GRANTOR_ROLE` | Contract-specific |

### 1.2 Function Access Control

Functions that change contract state, their required roles, and their type. View and pure functions are not included.

| Function | Required Role | Type |
|----------|---------------|------|
| `upgradeToAndCall()` | `OWNER_ROLE` | Inherited |
| `pause()` | `PAUSER_ROLE` | Inherited |
| `unpause()` | `PAUSER_ROLE` | Inherited |
| `rescueERC20()` | `RESCUER_ROLE` | Inherited |
| `initialize()` | None | Contract-specific |
| `approve()` | `OWNER_ROLE` | Contract-specific |
| `setTreasury()` | `OWNER_ROLE` | Contract-specific |
| `issueAsset()` | `MANAGER_ROLE` | Contract-specific |
| `redeemAsset()` | `MANAGER_ROLE` | Contract-specific |

---

## 2. External Role Requirements

Roles that must be granted to `AssetTransitDesk` on external contracts to allow function calls.

**Note:** `REQUIRES_ROLE` indicates that the actual role name must be determined from the external contract.

**Note:** `ALLOWANCE` indicates that allowance must be configured by token holder.

| External Contract | Function Called | Role to Grant | Granted To | AssetTransitDesk Function |
|-------------------|----------------|---------------|------------|---------------------------|
| **Treasury** (ITreasury) | `withdraw(uint256)` | `REQUIRES_ROLE` | AssetTransitDesk address | `redeemAsset()` |
| **UnderlyingToken** (IERC20) | `safeTransferFrom(address, address, uint256)` | `ALLOWANCE` | AssetTransitDesk address | `issueAsset()` |
| **UnderlyingToken** (IERC20) | `safeTransfer(address, uint256)` | None | N/A | `issueAsset()`, `redeemAsset()` |
| **UnderlyingToken** (IERC20) | `approve(address, uint256)` | None | N/A | `approve()` |
