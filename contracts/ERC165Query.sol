pragma solidity ^0.4.24;

/// @title ERC165
/// @author @fulldecent and @jbaylina
/// @notice A library that detects which interfaces other contracts implement
/// @dev Based on https://github.com/ethereum/EIPs/pull/881

library ERC165Query {
    bytes4 constant internal INVALID_ID = 0xffffffff;
    bytes4 constant internal ERC165_ID = 0x01ffc9a7;

    /// @dev Checks if a given contract address implement a given interface using
    ///  pseudo-introspection (ERC165)
    /// @param _contract Smart contract to check
    /// @param _interfaceId Interface to check
    /// @return `true` if the contract implements both ERC165 and `_interfaceId`
    function doesContractImplementInterface(address _contract, bytes4 _interfaceId)
        internal
        view
        returns (bool)
    {
        uint256 success;
        uint256 result;

        (success, result) = noThrowCall(_contract, ERC165_ID);
        if ((success == 0) || (result == 0)) {
            return false;
        }

        (success, result) = noThrowCall(_contract, INVALID_ID);
        if ((success == 0) || (result != 0)) {
            return false;
        }

        (success, result) = noThrowCall(_contract, _interfaceId);
        if ((success == 1) && (result == 1)) {
            return true;
        }
        return false;
    }

    /// @dev `Calls supportsInterface(_interfaceId)` on a contract without throwing an error
    /// @param _contract Smart contract to call
    /// @param _interfaceId Interface to call
    /// @return `success` is `true` if the call was successful; `result` is the result of the call
    function noThrowCall(address _contract, bytes4 _interfaceId)
        internal
        view
        returns (uint256 success, uint256 result)
    {
        bytes4 erc165ID = ERC165_ID;

        // solhint-disable-next-line no-inline-assembly
        assembly {
                let x := mload(0x40)               // Find empty storage location using "free memory pointer"
                mstore(x, erc165ID)                // Place signature at begining of empty storage
                mstore(add(x, 0x04), _interfaceId) // Place first argument directly next to signature

                success := staticcall(
                                    30000,         // 30k gas
                                    _contract,     // To addr
                                    x,             // Inputs are stored at location x
                                    0x20,          // Inputs are 32 bytes long
                                    x,             // Store output over input (saves space)
                                    0x20)          // Outputs are 32 bytes long

                result := mload(x)                 // Load the result
        }
    }
}