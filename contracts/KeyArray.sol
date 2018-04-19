pragma solidity ^0.4.22;

/// @title KeyArray
/// @author Mircea Pasoi
/// @notice Library for managing an arrray of ERC 725 keys
library KeyArray {
    struct Key {
        uint256 purpose; //e.g., MANAGEMENT_KEY = 1, ACTION_KEY = 2, etc.
        uint256 keyType; // e.g. 1 = ECDSA, 2 = RSA, etc.
        bytes32 key; // for non-hex and long keys, its the Keccak256 hash of the key
    }

    /// @dev Find a key + purpose tuple in the array
    /// @param key Key bytes to find
    /// @param purpose Purpose to find
    /// @return (index, found) `true` if key + purpose tuple if found, including the index in the array
    function find(Key[] storage self, bytes32 key, uint256 purpose)
        internal
        view
        returns (uint idx, bool found)
    {
        for (idx = 0; idx < self.length; idx++) {
            if (self[idx].key == key && self[idx].purpose == purpose) {
                found = true;
                return;
            }
        }
        idx = 0;
    }

    /// @dev Add a Key in the array
    /// @param key Key bytes to add
    /// @param purpose Purpose to add
    /// @param keyType Key type to add
    function add(Key[] storage self, bytes32 key, uint256 purpose, uint256 keyType)
        internal
    {
        self.push(Key(purpose, keyType, key));
    }

    /// @dev Remove Key from the array
    /// @param index Index in the array for the key to remove
    /// @return Key type of the key that was removed
    function remove(Key[] storage self, uint index)
        internal
        returns (uint256 keyType)
    {
        keyType = self[index].keyType;
        self[index] = self[self.length - 1];
        delete self[self.length - 1];
        self.length--;
    }
}