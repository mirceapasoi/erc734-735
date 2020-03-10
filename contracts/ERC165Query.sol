pragma solidity ^0.5.16;

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
        bool success;
        bool result;

        (success, result) = noThrowCall(_contract, ERC165_ID);
        if (!success || !result) {
            return false;
        }

        (success, result) = noThrowCall(_contract, INVALID_ID);
        if (!success || result) {
            return false;
        }

        (success, result) = noThrowCall(_contract, _interfaceId);
        if (success && result) {
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
        returns (bool success, bool result)
    {
        bytes memory payload = abi.encodeWithSelector(ERC165_ID, _interfaceId);
        bytes memory resultData;
        // solhint-disable-next-line avoid-low-level-calls
        (success, resultData) = _contract.staticcall(payload);
        // solhint-disable-next-line no-inline-assembly
        assembly {
            result := mload(add(resultData, 0x20))
        }
    }
}