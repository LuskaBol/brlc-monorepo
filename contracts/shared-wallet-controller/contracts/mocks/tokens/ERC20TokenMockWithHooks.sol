// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20Hook } from "../../interfaces/IERC20Hook.sol";

/**
 * @title ERC20TokenMockWithHooks contract
 * @author CloudWalk Inc. (See https://www.cloudwalk.io)
 * @dev An implementation of the {ERC20} contract for testing purposes that calls IERC20Hook functions.
 */
contract ERC20TokenMockWithHooks is ERC20 {
    /// @dev The hook contract that will receive transfer notifications
    IERC20Hook public hookContract;

    // ------------------ Constructor ----------------------------- //

    /**
     * @dev The constructor of the contract.
     * @param name_ The name of the token to set for this ERC20-compatible contract.
     * @param symbol_ The symbol of the token to set for this ERC20-compatible contract.
     */
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    // ------------------ Transactional functions ----------------- //

    /**
     * @dev Sets the hook contract that will receive transfer notifications.
     * @param _hookContract The address of the hook contract.
     */
    function setHookContract(address _hookContract) external {
        hookContract = IERC20Hook(_hookContract);
    }

    /**
     * @dev Calls the appropriate internal function to mint needed amount of tokens for an account.
     * @param account The address of an account to mint for.
     * @param amount The amount of tokens to mint.
     */
    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    /**
     * @dev Override the internal _update function to call hooks.
     * @param from The address tokens are transferred from.
     * @param to The address tokens are transferred to.
     * @param value The amount of tokens transferred.
     */
    function _update(address from, address to, uint256 value) internal override {
        // Call beforeTokenTransfer hook if hook contract is set
        if (address(hookContract) != address(0)) {
            hookContract.beforeTokenTransfer(from, to, value);
        }

        // Execute the actual transfer
        super._update(from, to, value);

        // Call afterTokenTransfer hook if hook contract is set
        if (address(hookContract) != address(0)) {
            hookContract.afterTokenTransfer(from, to, value);
        }
    }
}
