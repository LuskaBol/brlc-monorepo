// SPDX-License-Identifier: MIT

pragma solidity ^0.8.30;

import { IMultiSigWallet } from "./IMultiSigWallet.sol";

/**
 * @title MultiSigGuardianWallet interface
 * @author CloudWalk Inc. (See https://www.cloudwalk.io)
 * @dev The interface of the multi-signature wallet contract with guardian support.
 *
 * Guardians are a designated subset of wallet owners whose participation is mandatory
 * for transaction execution. This adds a secondary approval requirement on top of the
 * standard multisig threshold.
 *
 * ## Example
 *
 * Consider a 2-of-4 multisig with owners [A, B, C, D] where A and B are key stakeholders.
 * By configuring A and B as guardians with `requiredGuardianApprovals = 1`:
 *
 * - A + C can execute ✓ (2 approvals, 1 guardian approval)
 * - B + D can execute ✓ (2 approvals, 1 guardian approval)
 * - C + D cannot execute ✗ (2 approvals, but 0 guardian approvals)
 *
 * ## Key Rules
 *
 * 1. Guardians must be a subset of the wallet owners list.
 * 2. A transaction requires BOTH:
 *    - At least `requiredApprovals` total approvals (standard rule)
 *    - At least `requiredGuardianApprovals` from guardians (guardian rule)
 * 3. Guardian approvals count toward the total approval count (not additive).
 * 4. If a guardian is removed from the owners list via `configureOwners()`,
 *    they automatically lose their guardian status to prevent deadlocks.
 *
 * ## Guardian Approval Calculation
 *
 * Guardian approvals are computed at execution time based on the CURRENT guardian list:
 * - Only approvals from addresses that are currently guardians count toward the guardian threshold.
 * - If an owner approves while being a guardian, then loses guardian status, their
 *   approval will NOT count toward the guardian threshold at execution time.
 * - This ensures the current guardian composition must approve the transaction.
 *
 * ## Auto-Cleanup Behavior
 *
 * When owners are reconfigured, the guardian configuration is automatically adjusted:
 * - If all guardians are removed: guardian requirement is disabled (requiredGuardianApprovals = 0)
 * - If some guardians are removed: requiredGuardianApprovals is reduced if needed
 *
 * This prevents the wallet from becoming permanently stuck.
 */
interface IMultiSigGuardianWallet is IMultiSigWallet {
    // ------------------ Events ---------------------------------- //

    /**
     * @dev Emitted when guardians are configured.
     * @param newGuardians The array of addresses that became the guardians.
     * @param newRequiredGuardianApprovals The new number of guardian approvals required to execute a transaction.
     */
    event ConfigureGuardians(address[] newGuardians, uint256 newRequiredGuardianApprovals);

    // ------------------ Errors ---------------------------------- //

    /// @dev An empty array of addresses was passed when configuring the guardians.
    error MultiSigGuardianWallet_GuardiansArrayEmpty();

    /// @dev A non-owner address was passed within the guardians array.
    error MultiSigGuardianWallet_GuardianNotInOwners();

    /// @dev A duplicate address was passed within the guardians array when configuring the guardians.
    error MultiSigGuardianWallet_GuardianAddressDuplicate();

    /// @dev An invalid number of required guardian approvals was passed when configuring the guardians.
    error MultiSigGuardianWallet_RequiredGuardianApprovalsInvalid();

    /// @dev The number of guardian approvals for a given transaction is less than the required minimum.
    error MultiSigGuardianWallet_GuardianApprovalsInsufficient();

    // ------------------ Transactional functions ----------------- //

    /**
     * @dev Configures guardians.
     *
     * Emits a {ConfigureGuardians} event.
     *
     * @param newGuardians The array of addresses to become the guardians.
     * @param newRequiredGuardianApprovals The new number of guardian approvals required to execute a transaction.
     */
    function configureGuardians(address[] memory newGuardians, uint16 newRequiredGuardianApprovals) external;

    // ------------------ View functions -------------------------- //

    /**
     * @dev Returns the number of guardian approvals for a transaction.
     * @param txId The ID of the transaction to check.
     */
    function getGuardianApprovalCount(uint256 txId) external view returns (uint256);

    /**
     * @dev Returns an array of guardians.
     */
    function guardians() external view returns (address[] memory);

    /**
     * @dev Checks if an account is configured as a guardian.
     * @param account The address to check.
     */
    function isGuardian(address account) external view returns (bool);

    /**
     * @dev Returns the number of guardian approvals required to execute a transaction.
     */
    function requiredGuardianApprovals() external view returns (uint256);
}
