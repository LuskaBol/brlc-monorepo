// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

/**
 * @title IAccessControlExtUpgradeable interface
 * @author CloudWalk Inc. (See https://www.cloudwalk.io)
 * @dev Interface for the extended access control functionality with OWNER_ROLE and GRANTOR_ROLE.
 */
interface IAccessControlExtUpgradeable is IAccessControl {
    // ------------------ Functions ------------------------------- //

    /**
     * @dev Returns the owner role constant.
     */
    function OWNER_ROLE() external view returns (bytes32);

    /**
     * @dev Returns the grantor role constant.
     */
    function GRANTOR_ROLE() external view returns (bytes32);

    /**
     * @dev Grants a role to accounts in batch.
     * @param role The role to grant.
     * @param accounts The accounts to grant the role to.
     */
    function grantRoleBatch(bytes32 role, address[] memory accounts) external;

    /**
     * @dev Revokes a role from accounts in batch.
     * @param role The role to revoke.
     * @param accounts The accounts to revoke the role from.
     */
    function revokeRoleBatch(bytes32 role, address[] memory accounts) external;

    /**
     * @dev Sets the admin role for a given role.
     * @param role The role to set the admin role for.
     * @param adminRole The admin role to set.
     */
    function setRoleAdmin(bytes32 role, bytes32 adminRole) external;
}
