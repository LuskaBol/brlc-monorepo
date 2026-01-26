// SPDX-License-Identifier: MIT

pragma solidity ^0.8.30;

import { ICreditLineTypes } from "@cloudwalk/brlc-capybara-finance/contracts/interfaces/ICreditLineTypes.sol";

/**
 * @title CreditLineV1Mock contract
 * @author CloudWalk Inc.
 * @dev Mock implementation of the `ICreditLine` interface from `@cloudwalk/brlc-capybara-finance`.
 */
contract CreditLineV1Mock is ICreditLineTypes {
    // ------------------ Storage --------------------------------- //

    /// @dev Mapping of borrower address to their state.
    mapping(address borrower => BorrowerState) private _borrowerStates;

    // ------------------ Transactional functions ----------------- //

    /**
     * @dev Sets the state of a borrower.
     * @param borrower The address of the borrower.
     * @param state The state to set for the borrower.
     */
    function setBorrowerState(address borrower, BorrowerState calldata state) external {
        _borrowerStates[borrower] = state;
    }

    function getBorrowerState(address borrower) external view returns (BorrowerState memory) {
        return _borrowerStates[borrower];
    }

    // ------------------ Pure functions -------------------------- //

    function proveCreditLine() external pure {}
}
