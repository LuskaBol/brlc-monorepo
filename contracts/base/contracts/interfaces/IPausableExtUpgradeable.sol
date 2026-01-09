// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

/**
 * @title IPausableExtUpgradeable interface
 * @author CloudWalk Inc. (See https://www.cloudwalk.io)
 * @dev Interface for the extended pausable functionality with PAUSER_ROLE.
 */
interface IPausableExtUpgradeable {
    // ------------------ Functions ------------------------------- //

    /**
     * @dev Returns the pauser role constant.
     */
    function PAUSER_ROLE() external view returns (bytes32);

    /**
     * @dev Triggers the paused state of the contract.
     */
    function pause() external;

    /**
     * @dev Triggers the unpaused state of the contract.
     */
    function unpause() external;
}
