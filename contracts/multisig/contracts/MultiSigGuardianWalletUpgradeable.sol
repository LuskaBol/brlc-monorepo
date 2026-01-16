// SPDX-License-Identifier: MIT

pragma solidity 0.8.30;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import { MultiSigGuardianWalletBase } from "./base/MultiSigGuardianWalletBase.sol";

/**
 * @title MultiSigGuardianWalletUpgradeable contract
 * @author CloudWalk Inc. (See https://www.cloudwalk.io)
 * @dev The implementation of the upgradeable multi-signature wallet contract with guardian support.
 *
 * Guardians are a designated group of owners where at least N approvals from this group
 * are required for transaction execution, in addition to the standard approval threshold.
 */
contract MultiSigGuardianWalletUpgradeable is Initializable, UUPSUpgradeable, MultiSigGuardianWalletBase {
    // ------------------ Constructor ----------------------------- //

    /**
     * @dev Constructor that prohibits the initialization of the implementation of the upgradeable contract.
     *
     * See details:
     * https://docs.openzeppelin.com/upgrades-plugins/writing-upgradeable#initializing_the_implementation_contract
     *
     * @custom:oz-upgrades-unsafe-allow constructor
     */
    constructor() {
        _disableInitializers();
    }

    // ------------------ Initializers ---------------------------- //

    /**
     * @dev Initializer of the upgradeable contract.
     *
     * See details: https://docs.openzeppelin.com/upgrades-plugins/writing-upgradeable
     *
     * Requirements:
     *
     * - The array of wallet owners must not be empty.
     * - The number of required approvals must not be zero and must not exceed the length of the wallet owners array.
     * - All guardians must be in the wallet owners list.
     * - The number of required guardian approvals must not be zero and must not exceed the guardians array length.
     *
     * @param newOwners An array of wallet owners.
     * @param newRequiredApprovals The number of required approvals to execute a transaction.
     * @param newGuardians An array of guardians (must be a subset of wallet owners).
     * @param newRequiredGuardianApprovals The number of required guardian approvals to execute a transaction.
     */
    function initialize(
        address[] memory newOwners,
        uint16 newRequiredApprovals,
        address[] memory newGuardians,
        uint16 newRequiredGuardianApprovals
    ) external initializer {
        _configureExpirationTime(10 days);
        _configureOwners(newOwners, newRequiredApprovals);
        _configureGuardians(newGuardians, newRequiredGuardianApprovals);
    }

    // ------------------ Internal functions ---------------------- //

    /**
     * @dev Upgrade authorization function.
     *
     * See details: https://docs.openzeppelin.com/upgrades-plugins/writing-upgradeable
     *
     * @param newImplementation The address of the new implementation.
     *
     * Requirements:
     *
     * - The caller must be the multi-signature wallet itself.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlySelfCall {}
}
