// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "./Pausable.sol";
import "./ERC734.sol";

/// @title KeyManager
/// @author Mircea Pasoi
/// @notice Implement add/remove functions from ERC734 spec
/// @dev Key data is stored using KeyStore library. Inheriting ERC734 for the events

abstract contract KeyManager is Pausable {
    /// @dev Add key data to the identity if key + purpose tuple doesn't already exist
    /// @param _key Key bytes to add
    /// @param _purpose Purpose to add
    /// @param _keyType Key type to add
    /// @return success `true` if key was added, `false` if it already exists
    function addKey(
        bytes32 _key,
        uint256 _purpose,
        uint256 _keyType
    )
        public
        onlyManagementOrSelf
        whenNotPaused
        override
        returns (bool success)
    {
        if (KeyStore.find(allKeys, _key, _purpose)) {
            return false;
        }
        _addKey(_key, _purpose, _keyType);
        return true;
    }

    /// @dev Remove key data from the identity
    /// @param _key Key bytes to remove
    /// @param _purpose Purpose to remove
    /// @return success `true` if key was found and removed, `false` if it wasn't found
    function removeKey(
        bytes32 _key,
        uint256 _purpose
    )
        public
        onlyManagementOrSelf
        whenNotPaused
        override
        returns (bool success)
    {
        if (!KeyStore.find(allKeys, _key, _purpose)) {
            return false;
        }
        uint256 keyType = KeyStore.remove(allKeys, _key, _purpose);
        emit KeyRemoved(_key, _purpose, keyType);
        return true;
    }

    /// @dev Add key data to the identity without checking if it already exists
    /// @param _key Key bytes to add
    /// @param _purpose Purpose to add
    /// @param _keyType Key type to add
    function _addKey(
        bytes32 _key,
        uint256 _purpose,
        uint256 _keyType
    )
        internal
    {
        KeyStore.add(allKeys, _key, _purpose, _keyType);
        emit KeyAdded(_key, _purpose, _keyType);
    }
}