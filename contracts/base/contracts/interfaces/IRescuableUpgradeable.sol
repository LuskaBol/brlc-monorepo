// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

/**
 * @title IRescuableUpgradeable interface
 * @author CloudWalk Inc. (See https://www.cloudwalk.io)
 * @dev Interface for the rescuable functionality with RESCUER_ROLE.
 */
interface IRescuableUpgradeable {
    // ------------------ Functions ------------------------------- //

    /**
     * @dev Returns the rescuer role constant.
     */
    function RESCUER_ROLE() external view returns (bytes32);

    /**
     * @dev Rescues tokens that were accidentally transferred to this contract.
     * @param token The address of the token smart contract to rescue its coins from this smart contract's account.
     * @param account The account to transfer the rescued tokens to.
     * @param amount The amount of tokens to rescue.
     */
    function rescueERC20(address token, address account, uint256 amount) external;
}
