// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import { RescuableEnumerableUpgradeable } from "../RescuableEnumerableUpgradeable.sol";

/**
 * @title RescuableEnumerableUpgradeableMock contract
 * @author CloudWalk Inc. (See https://www.cloudwalk.io)
 * @dev An implementation of the {RescuableEnumerableUpgradeable} contract for test purposes.
 */
contract RescuableEnumerableUpgradeableMock is RescuableEnumerableUpgradeable, UUPSUpgradeable {
    // ------------------ Initializers ---------------------------- //

    /**
     * @dev Initializer of the upgradeable contract.
     *
     * See details: https://docs.openzeppelin.com/upgrades-plugins/writing-upgradeable
     */
    function initialize() public initializer {
        __AccessControlEnumerableExt_init_unchained();
        __RescuableEnumerable_init_unchained();

        _grantRole(OWNER_ROLE, _msgSender());

        // Only to provide 100% test coverage
        _authorizeUpgrade(address(0));
    }

    // ------------------ Transactional functions ----------------- //

    /// @dev Calls the parent internal unchained initialization function to verify the 'onlyInitializing' modifier.
    function callParentInitializerUnchained() external {
        __RescuableEnumerable_init_unchained();
    }

    // ------------------ Internal functions ---------------------- //

    /**
     * @dev The implementation of the upgrade authorization function of the parent UUPSUpgradeable contract.
     * @param newImplementation The address of the new implementation.
     */
    function _authorizeUpgrade(address newImplementation) internal pure override {
        newImplementation; // Suppresses a compiler warning about the unused variable
    }
}
