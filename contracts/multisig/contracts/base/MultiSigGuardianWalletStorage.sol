// SPDX-License-Identifier: MIT

pragma solidity ^0.8.30;

/**
 * @title MultiSigGuardianWallet storage - version 1
 * @author CloudWalk Inc. (See https://www.cloudwalk.io)
 */
abstract contract MultiSigGuardianWalletStorageV1 {
    /// @dev The array of guardians.
    address[] internal _guardians;

    /// @dev The number of guardian approvals required to execute a transaction.
    uint16 internal _requiredGuardianApprovals;

    /**
     * @dev This empty reserved space is put in place to allow future versions
     * to add new variables without shifting down storage in the inheritance chain.
     */
    uint256[48] private __gap;
}

/**
 * @title MultiSigGuardianWallet storage
 * @author CloudWalk Inc. (See https://www.cloudwalk.io)
 * @dev Contains storage variables of the multi-signature guardian wallet contract.
 *
 * When we need to add new storage variables, we create a new version of MultiSigGuardianWalletStorage
 * e.g. MultiSigGuardianWalletStorage<versionNumber>, so at the end it would look like
 * "contract MultiSigGuardianWalletStorage is MultiSigGuardianWalletStorageV1, MultiSigGuardianWalletStorageV2".
 */
abstract contract MultiSigGuardianWalletStorage is MultiSigGuardianWalletStorageV1 {}
