// SPDX-License-Identifier: MIT

pragma solidity 0.8.30;

import { MultiSigGuardianWalletBase } from "./base/MultiSigGuardianWalletBase.sol";

/**
 * @title MultiSigGuardianWallet contract
 * @author CloudWalk Inc. (See https://www.cloudwalk.io)
 * @dev The implementation of the multi-signature wallet contract with guardian support.
 *
 * Guardians are a designated group of owners where at least N approvals from this group
 * are required for transaction execution, in addition to the standard approval threshold.
 */
contract MultiSigGuardianWallet is MultiSigGuardianWalletBase {
    /**
     * @dev Constructor that sets multi-signature wallet owners, required approvals, and guardians.
     *
     * Requirements:
     *
     * - The array of wallet owners must not be empty.
     * - The number of required approvals must not be zero and must not exceed the length of the wallet owners array.
     * - If the guardians array is empty, the required guardian approvals must be zero.
     * - If the guardians array is not empty, all guardians must be in the wallet owners list.
     * - If the guardians array is not empty, the required guardian approvals must not be zero
     *   and must not exceed the guardians array length.
     *
     * @param newOwners An array of wallet owners.
     * @param newRequiredApprovals The number of required approvals to execute a transaction.
     * @param newGuardians An array of guardians (must be a subset of wallet owners, or empty to disable).
     * @param newRequiredGuardianApprovals The number of required guardian approvals (zero if guardians disabled).
     */
    constructor(
        address[] memory newOwners,
        uint16 newRequiredApprovals,
        address[] memory newGuardians,
        uint16 newRequiredGuardianApprovals
    ) {
        _configureExpirationTime(10 days);
        _configureOwners(newOwners, newRequiredApprovals);
        _configureGuardians(newGuardians, newRequiredGuardianApprovals);
    }
}
