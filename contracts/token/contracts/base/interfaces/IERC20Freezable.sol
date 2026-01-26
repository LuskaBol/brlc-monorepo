// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @title IERC20FreezableErrors interface
 * @author CloudWalk Inc. (See https://www.cloudwalk.io)
 * @dev Defines the custom errors used in the ERC20Freezable contract.
 */
interface IERC20FreezableErrors {
    /**
     * @dev [DEPRECATED] The token freezing operation is not approved by the account. No longer in use.
     *
     * Kept for backward compatibility with transaction analysis tools.
     */
    error ERC20Freezable_FreezingUnapproved();

    /**
     * @dev [DEPRECATED] The token freezing is already approved by the account. No longer in use.
     *
     * Kept for backward compatibility with transaction analysis tools.
     */
    error ERC20Freezable_FreezingAlreadyApproved();

    /// @dev The frozen balance is exceeded during the operation.
    error ERC20Freezable_FrozenBalanceInsufficient();

    /// @dev The transfer amount exceeded the frozen amount.
    error ERC20Freezable_FrozenAmountExcess();

    /**
     * @dev [DEPRECATED] The transaction sender is not a freezer. No longer in use.
     *
     * Kept for backward compatibility with transaction analysis tools.
     * Replaced by an appropriate error from the `AccessControl` library smart contract.
     */
    error ERC20Freezable_FreezerUnauthorized();

    /// @dev The provided address belongs to a contract so its balance cannot be frozen.
    error ERC20Freezable_ContractBalanceFreezingAttempt();
}

/**
 * @title IERC20Freezable interface
 * @author CloudWalk Inc. (See https://www.cloudwalk.io)
 * @dev The interface of a token that supports freezing operations.
 */
interface IERC20Freezable is IERC20FreezableErrors {
    // ------------------ Events ---------------------------------- //

    /**
     * @dev [DEPRECATED] Emitted when an account is assigned as a freezer. No longer in use.
     *
     * Kept for backward compatibility with transaction analysis tools.
     * Replaced by an appropriate role granting event from the `AccessControl` library smart contract.
     *
     * @param freezer The address of the assigned freezer.
     */
    event FreezerAssigned(address indexed freezer);

    /**
     * @dev [DEPRECATED] Emitted when an account is removed as a freezer. No longer in use.
     *
     * Kept for backward compatibility with transaction analysis tools.
     * Replaced by an appropriate role revocation event from the `AccessControl` library smart contract.
     *
     * @param freezer The address of the removed freezer.
     */
    event FreezerRemoved(address indexed freezer);

    /**
     * @dev [DEPRECATED] Emitted when token freezing has been approved for an account. No longer in use.
     *
     * Kept for backward compatibility with transaction analysis tools.
     *
     * @param account The account for which token freezing has been approved.
     */
    event FreezeApproval(address indexed account);

    /**
     * @dev Emitted when frozen tokens have been transferred from an account.
     * @param account The account from which frozen tokens have been transferred.
     * @param amount The amount of frozen tokens transferred.
     */
    event FreezeTransfer(address indexed account, uint256 amount);

    /**
     * @dev Emitted when token freezing has been performed for a specific account.
     * @param account The account for which token freezing has been performed.
     * @param newFrozenBalance The updated frozen balance of the account.
     * @param oldFrozenBalance The previous frozen balance of the account.
     */
    event Freeze(address indexed account, uint256 newFrozenBalance, uint256 oldFrozenBalance);

    // ------------------ Transactional functions ----------------- //

    /**
     * @dev Transfers frozen tokens on behalf of an account.
     *
     * Emits a {FreezeTransfer} event.
     *
     * @param from The account tokens will be transferred from.
     * @param to The account tokens will be transferred to.
     * @param amount The amount of tokens to transfer.
     * @return newBalance The frozen balance of the `from` account after the transfer.
     * @return oldBalance The frozen balance of the `from` account before the transfer.
     */
    function transferFrozen(
        address from, // Tools: prevent Prettier one-liner
        address to,
        uint256 amount
    ) external returns (uint256 newBalance, uint256 oldBalance);

    /**
     * @dev [DEPRECATED] Updates the frozen balance of an account.
     *
     * Emits a {Freeze} event.
     *
     * IMPORTANT: This function is deprecated and will be removed in the future updates of the contract.
     *            Use the {freezeIncrease} and {freezeDecrease} functions instead.
     *
     * Requirements:
     *
     * - The contract must not be paused
     * - Can only be called by a freezer
     * - The account address must not be zero
     *
     * @param account The account to update the frozen balance for.
     * @param amount The amount of tokens to set as the new frozen balance.
     * @return newBalance The frozen balance of the account after the update.
     * @return oldBalance The frozen balance of the account before the update.
     */
    function freeze(
        address account, // Tools: prevent Prettier one-liner
        uint256 amount
    ) external returns (uint256 newBalance, uint256 oldBalance);

    /**
     * @dev Increases the frozen balance of an account.
     *
     * Emits a {Freeze} event.
     *
     * @param account The account to increase frozen balance for.
     * @param amount The amount to increase the frozen balance by.
     * @return newBalance The frozen balance of the account after the increase.
     * @return oldBalance The frozen balance of the account before the increase.
     */
    function freezeIncrease(
        address account, // Tools: prevent Prettier one-liner
        uint256 amount
    ) external returns (uint256 newBalance, uint256 oldBalance);

    /**
     * @dev Decreases the frozen balance of an account.
     *
     * Emits a {Freeze} event.
     *
     * @param account The account to decrease frozen balance for.
     * @param amount The amount to decrease the frozen balance by.
     * @return newBalance The frozen balance of the account after the decrease.
     * @return oldBalance The frozen balance of the account before the decrease.
     */
    function freezeDecrease(
        address account, // Tools: prevent Prettier one-liner
        uint256 amount
    ) external returns (uint256 newBalance, uint256 oldBalance);

    // ------------------ View functions -------------------------- //

    /**
     * @dev Retrieves the frozen balance of an account.
     * @param account The account to check the balance of.
     * @return The amount of tokens that are frozen for the account.
     */
    function balanceOfFrozen(address account) external view returns (uint256);
}
