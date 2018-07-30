pragma solidity ^0.4.21;

/// @title Slice
/// @author https://github.com/nick
/// @notice Library for slices variable-length types (bytes, string)

library Slice {
    /// @dev Slice a bytes array
    /// @param offset Index to start slice at
    /// @param length Length of slice
    /// @return Sliced bytes array
    function slice(
        bytes self,
        uint256 offset,
        uint8 length
    )
        internal
        pure
        returns (bytes)
    {
        bytes memory s = new bytes(length);
        uint256 i = 0;
        for (uint256 j = offset; j < offset + length; j++) {
            s[i++] = self[j];
        }
        return s;
    }

    /// @dev Slice a string
    /// @param offset Index to start slice at
    /// @param length Length of slice
    /// @return Sliced string
    function slice(
        string self,
        uint256 offset,
        uint8 length
    )
        internal
        pure
        returns (string)
    {
        return string(slice(bytes(self), offset, length));
    }
}