pragma solidity ^0.4.22;

import "./KeyBase.sol";

/// @title KeyGetters
/// @author Mircea Pasoi
/// @notice Implement getter functions from ERC725 spec
/// @dev Key data is stored in an array using KeyArray library
contract KeyGetters is KeyBase {
    /// @dev Find the key data, if held by the identity
    /// @param _key Key bytes to find
    /// @param _purpose Purpose to find
    /// @return `(purpose, keyType, key)` tuple if the key exists
    function getKey(
        bytes32 _key,
        uint256 _purpose
    )
        public
        view
        returns(uint256 purpose, uint256 keyType, bytes32 key)
    {
        uint index;
        bool found;
        (index, found) = allKeys.find(_key, _purpose);
        if (found) {
            purpose = _purpose;
            keyType = allKeys[index].keyType;
            key = _key;
        }
    }

    /// @dev Find all the purposes of the key, if held by the identity
    /// @param _key Key bytes to find
    /// @return Array with purposes for that key (empty if none)
    function getKeyPurpose(bytes32 _key)
        public
        view
        returns(uint256[] purpose)
    {
        uint count = 0;
        for (uint i = 0; i < allKeys.length; i++) {
            if (allKeys[i].key == _key) {
                count++;
            }
        }
        purpose = new uint256[](count);
        for (count = i = 0; i < allKeys.length; i++) {
            if (allKeys[i].key == _key) {
                purpose[count++] = allKeys[i].purpose;
            }
        }
    }

    /// @dev Find all the keys held by this identity for a given purpose
    /// @param _purpose Purpose to find
    /// @return Array with key bytes for that purpose (empty if none)
    function getKeysByPurpose(uint256 _purpose)
        public
        view
        returns(bytes32[] keys)
    {
        uint count = 0;
        for (uint i = 0; i < allKeys.length; i++) {
            if (allKeys[i].purpose == _purpose) {
                count++;
            }
        }
        keys = new bytes32[](count);
        for (count = i = 0; i < allKeys.length; i++) {
            if (allKeys[i].purpose == _purpose) {
                keys[count++] = allKeys[i].key;
            }
        }
    }
}