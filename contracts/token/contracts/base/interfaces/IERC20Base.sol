// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @title IERC20BaseErrors interface
 * @author CloudWalk Inc. (See https://www.cloudwalk.io)
 * @dev Defines the custom errors used in the ERC20Base contract.
 */
interface IERC20BaseErrors {
    /// @dev Throws if the zero address is passed to the function.
    error ERC20Base_AddressZero();

    /// @dev Throws if the zero amount is passed to the function.
    error ERC20Base_AmountZero();
}
