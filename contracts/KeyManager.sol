pragma solidity ^0.4.21;

import "./Pausable.sol";
import "./ERC725.sol";

/// @title KeyManager
/// @author Mircea Pasoi
/// @notice Implement add/remove functions from ERC725 spec
/// @dev Key data is stored in an array using KeyArray library. Inheriting ERC725 for the events
contract KeyManager is Pausable, ERC725 {
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
        allKeys.add(_key, _purpose, _keyType);
        emit KeyAdded(_key, _purpose, _keyType);
    }

    /// @dev Add key data to the identity if key + purpose tuple doesn't already exist
    /// @param _key Key bytes to add
    /// @param _purpose Purpose to add
    /// @param _keyType Key type to add
    /// @return `true` if key was added, `false` if it already exists
    function addKey(
        bytes32 _key,
        uint256 _purpose,
        uint256 _keyType
    )
        public
        onlyManagementOrSelf
        whenNotPaused
        returns (bool success)
    {
        bool found;
        (, found) = allKeys.find(_key, _purpose);
        if (found) {
            return false;
        }
        _addKey(_key, _purpose, _keyType);
        return true;
    }
    /// @dev Remove key data from the identity
    /// @param _key Key bytes to remove
    /// @param _purpose Purpose to remove
    /// @return `true` if key was found and removed, `false` if it wasn't found
    function removeKey(
        bytes32 _key,
        uint256 _purpose
    )
        public
        onlyManagementOrSelf
        whenNotPaused
        returns (bool success)
    {
        uint index;
        bool found;
        (index, found) = allKeys.find(_key, _purpose);
        if (found) {
            uint256 keyType = allKeys.remove(index);
            emit KeyRemoved(_key, _purpose, keyType);
        }
        return found;
    }
}