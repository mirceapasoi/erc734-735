pragma solidity ^0.4.21;

import "./KeyBase.sol";

/// @title Destructible
/// @author Mircea Pasoi
/// @notice Base contract that can be destroyed by MANAGEMENT_KEY or the identity itself
/// @dev Inspired by https://github.com/OpenZeppelin/zeppelin-solidity/blob/master/contracts/lifecycle/Destructible.sol
contract Destructible is KeyBase {
    /// @dev Transfers the current balance and terminates the contract
    /// @param _recipient All funds in contract will be sent to this recipient
    function destroyAndSend(address _recipient)
        onlyManagementOrSelf
        public
    {
        require(_recipient != address(0));
        selfdestruct(_recipient);
    }
}