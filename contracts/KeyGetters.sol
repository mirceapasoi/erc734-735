// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "./KeyBase.sol";
import "./ERC725.sol";

/// @title KeyGetters
/// @author Mircea Pasoi
/// @notice Implement getter functions from ERC725 spec
/// @dev Key data is stored using KeyStore library

abstract contract KeyGetters is KeyBase {
    /// @dev Find the key data, if held by the identity
    /// @param _key Key bytes to find
    /// @return purposes Array if the key exists
    /// @return keyType Type if the key exists
    /// @return key Bytes if the key exists
    function getKey(
        bytes32 _key
    )
        public
        view
        override
        returns(uint256[] memory purposes, uint256 keyType, bytes32 key)
    {
        KeyStore.Key memory k = allKeys.keyData[_key];
        purposes = k.purposes;
        keyType = k.keyType;
        key = k.key;
    }

    /// @dev Find if a key has is present and has the given purpose
    /// @param _key Key bytes to find
    /// @param purpose Purpose to find
    /// @return exists Boolean indicating whether the key exists or not
    function keyHasPurpose(
        bytes32 _key,
        uint256 purpose
    )
        public
        view
        override
        returns(bool exists)
    {
        return KeyStore.find(allKeys, _key, purpose);
    }

    /// @dev Find all the keys held by this identity for a given purpose
    /// @param _purpose Purpose to find
    /// @return keys Array with key bytes for that purpose (empty if none)
    function getKeysByPurpose(uint256 _purpose)
        public
        view
        override
        returns(bytes32[] memory keys)
    {
        return allKeys.keysByPurpose[_purpose];
    }
}