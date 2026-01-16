// SPDX-License-Identifier: MIT

pragma solidity ^0.8.30;

import { IMultiSigGuardianWallet } from "./IMultiSigGuardianWallet.sol";
import { MultiSigGuardianWalletStorage } from "./MultiSigGuardianWalletStorage.sol";
import { MultiSigWalletBase } from "./MultiSigWalletBase.sol";

/**
 * @title MultiSigGuardianWalletBase contract
 * @author CloudWalk Inc. (See https://www.cloudwalk.io)
 * @dev The base of the multi-signature wallet contract with guardian support.
 *
 * Guardians are a designated group of owners where at least N approvals from this group
 * are required for transaction execution, in addition to the standard approval threshold.
 */
abstract contract MultiSigGuardianWalletBase is
    MultiSigWalletBase,
    MultiSigGuardianWalletStorage,
    IMultiSigGuardianWallet
{
    // ------------------ Transactional functions ----------------- //

    /**
     * @inheritdoc IMultiSigGuardianWallet
     *
     * @dev Requirements:
     *
     * - The array of guardians must not be empty.
     * - All guardians must be in the wallet owners list.
     * - The number of required guardian approvals must not be zero and must not exceed the guardians array length.
     */
    function configureGuardians(
        address[] memory newGuardians,
        uint16 newRequiredGuardianApprovals
    ) external onlySelfCall {
        _configureGuardians(newGuardians, newRequiredGuardianApprovals);
    }

    // ------------------ View functions -------------------------- //

    /**
     * @inheritdoc IMultiSigGuardianWallet
     */
    function getGuardianApprovalCount(uint256 txId) external view returns (uint256) {
        return _getGuardianApprovalCount(txId);
    }

    /**
     * @inheritdoc IMultiSigGuardianWallet
     */
    function guardians() external view returns (address[] memory) {
        return _guardians;
    }

    /**
     * @inheritdoc IMultiSigGuardianWallet
     */
    function isGuardian(address account) external view returns (bool) {
        return _isGuardian(account);
    }

    /**
     * @inheritdoc IMultiSigGuardianWallet
     */
    function requiredGuardianApprovals() external view returns (uint256) {
        return _requiredGuardianApprovals;
    }

    // ------------------ Internal functions ---------------------- //

    /**
     * @dev Hook override that checks guardian approval requirements before execution.
     *
     * Computes the guardian approval count on-the-fly by checking which current guardians
     * have approved the transaction. This ensures only approvals from current guardians
     * are counted at execution time.
     *
     * Requirements:
     *
     * - The transaction must have at least the required number of guardian approvals.
     *
     * @param txId The ID of the transaction to be executed.
     */
    function _beforeExecute(uint256 txId) internal virtual override {
        uint256 required = _requiredGuardianApprovals;

        // If guardian requirement is disabled, allow execution
        if (required == 0) {
            return;
        }

        uint256 count = 0;
        uint256 len = _guardians.length;

        for (uint256 i = 0; i < len; ++i) {
            if (_approvalStatus[txId][_guardians[i]]) {
                ++count;
                if (count >= required) {
                    return; // Early exit once threshold met
                }
            }
        }

        revert MultiSigGuardianWallet_GuardianApprovalsInsufficient();
    }

    /**
     * @dev Computes the number of guardian approvals for a transaction.
     *
     * Iterates through current guardians and counts how many have approved.
     *
     * @param txId The ID of the transaction to check.
     * @return count The number of guardian approvals.
     */
    function _getGuardianApprovalCount(uint256 txId) internal view returns (uint256 count) {
        uint256 len = _guardians.length;
        for (uint256 i = 0; i < len; ++i) {
            if (_approvalStatus[txId][_guardians[i]]) {
                ++count;
            }
        }
    }

    /**
     * @dev Checks if an account is a guardian.
     *
     * @param account The address to check.
     * @return True if the account is a guardian, false otherwise.
     */
    function _isGuardian(address account) internal view returns (bool) {
        uint256 len = _guardians.length;
        for (uint256 i = 0; i < len; ++i) {
            if (_guardians[i] == account) {
                return true;
            }
        }
        return false;
    }

    /**
     * @dev Hook override that performs automatic guardian cleanup after owners are configured.
     *
     * If removing an owner causes the guardian configuration to become invalid, the required guardian approvals
     * will be automatically reduced to match the number of remaining valid guardians.
     *
     * May emit a {ConfigureGuardians} event if guardians are cleaned up.
     */
    function _afterConfigureOwners() internal virtual override {
        _cleanupGuardians();
    }

    /**
     * @dev Configures guardians internally. See {IMultiSigGuardianWallet-configureGuardians}.
     *
     * Emits a {ConfigureGuardians} event.
     */
    function _configureGuardians(address[] memory newGuardians, uint16 newRequiredGuardianApprovals) internal {
        uint256 len = newGuardians.length;

        if (len == 0) {
            revert MultiSigGuardianWallet_GuardiansArrayEmpty();
        }
        if (newRequiredGuardianApprovals == 0) {
            revert MultiSigGuardianWallet_RequiredGuardianApprovalsInvalid();
        }
        if (newRequiredGuardianApprovals > len) {
            revert MultiSigGuardianWallet_RequiredGuardianApprovalsInvalid();
        }

        // Validate new guardians
        for (uint256 i = 0; i < len; ++i) {
            address guardian = newGuardians[i];

            // Guardian must be in the owners list
            if (!_isOwner[guardian]) {
                revert MultiSigGuardianWallet_GuardianNotInOwners();
            }

            // Check for duplicates by scanning previous entries
            for (uint256 j = 0; j < i; ++j) {
                if (newGuardians[j] == guardian) {
                    revert MultiSigGuardianWallet_GuardianAddressDuplicate();
                }
            }
        }

        _guardians = newGuardians;
        _requiredGuardianApprovals = newRequiredGuardianApprovals;

        emit ConfigureGuardians(newGuardians, newRequiredGuardianApprovals);
    }

    /**
     * @dev Clears guardian status for owners that are no longer in the owners list.
     *
     * This should be called after configuring owners to maintain consistency.
     */
    function _cleanupGuardians() internal {
        uint256 len = _guardians.length;

        // Step 1: Collect valid guardians (those still in owners)
        address[] memory validGuardians = new address[](len);
        uint256 validCount = 0;

        for (uint256 i = 0; i < len; ++i) {
            address guardian = _guardians[i];
            if (_isOwner[guardian]) {
                validGuardians[validCount] = guardian;
                ++validCount;
            }
        }

        // Step 2: Early exit if all guardians are still valid
        if (validCount == len) {
            return;
        }

        // Step 3: Clear guardians array
        delete _guardians;

        // Step 4: Disable guardian requirement
        if (validCount == 0) {
            _requiredGuardianApprovals = 0;
            emit ConfigureGuardians(new address[](0), 0);
            return;
        }

        // Step 5: Push valid guardians back to storage
        for (uint256 i = 0; i < validCount; ++i) {
            _guardians.push(validGuardians[i]);
        }

        // Step 6: Adjust required approvals
        if (_requiredGuardianApprovals > validCount) {
            _requiredGuardianApprovals = uint16(validCount);
        }

        emit ConfigureGuardians(_guardians, _requiredGuardianApprovals);
    }
}
