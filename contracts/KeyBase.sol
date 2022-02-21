// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "./KeyStore.sol";
import "./ERC725.sol";

/// @title KeyBase
/// @author Mircea Pasoi
/// @notice Abstract contract for ERC725 implementation
/// @dev Key data is stored using KeyStore library

abstract contract KeyBase is ERC725 {
    // For multi-sig
    uint256 public managementRequired = 1;
    uint256 public executionRequired = 1;

    // Key storage
    KeyStore.Keys internal allKeys;

    /// @dev Number of keys managed by the contract
    /// @return Unsigned integer number of keys
    function numKeys()
        external
        view
        returns (uint)
    {
        return allKeys.numKeys;
    }

    /// @dev Convert an Ethereum address (20 bytes) to an ERC725 key (32 bytes)
    /// @dev It's just a simple typecast, but it's especially useful in tests
    function addrToKey(address addr)
        public
        pure
        returns (bytes32)
    {
        return bytes32(uint256(uint160(addr)));
    }

    /// @dev Checks if sender is either the identity contract or a MANAGEMENT_KEY
    /// @dev If the multi-sig threshold for MANAGEMENT_KEY if >1, it will throw an error
    /// @return found `true` if sender is either identity contract or a MANAGEMENT_KEY
    function _managementOrSelf()
        internal
        view
        returns (bool found)
    {
        if (msg.sender == address(this)) {
            // Identity contract itself
            return true;
        }
        // Only works with 1 key threshold, otherwise need multi-sig
        require(managementRequired == 1, "management threshold >1");
        return KeyStore.find(allKeys, addrToKey(msg.sender), MANAGEMENT_KEY);
    }

    /// @dev Modifier that only allows keys of purpose 1, or the identity itself
    modifier onlyManagementOrSelf {
        require(_managementOrSelf(), "only management or self");
        _;
    }
}
