// SPDX-License-Identifier: MIT

pragma solidity ^0.8.30;

/**
 * @title IAddressBookEvents interface
 * @author CloudWalk Inc. (See https://www.cloudwalk.io)
 * @dev Defines events emitted by the AddressBook library.
 */
interface IAddressBookEvents {
    /**
     * @dev Emitted when a new account is added to the address book.
     * @param account The address of the account added.
     * @param id The ID assigned to the account.
     */
    event AddressBookAccountAdded(address indexed account, uint256 indexed id);
}
