// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "./KeyBase.sol";

/// @title Pausable
/// @author Mircea Pasoi
/// @notice Base contract which allows children to implement an emergency stop mechanism
/// @dev Inspired by https://github.com/OpenZeppelin/zeppelin-solidity/blob/master/contracts/lifecycle/Pausable.sol

abstract contract Pausable is KeyBase {
    event LogPause();
    event LogUnpause();

    bool public paused = false;

    /// @dev Modifier to make a function callable only when the contract is not paused
    modifier whenNotPaused() {
        require(!paused, "contract paused");
        _;
    }

    /// @dev Modifier to make a function callable only when the contract is paused
    modifier whenPaused() {
        require(paused, "contract not paused");
        _;
    }

    /// @dev called by a MANAGEMENT_KEY or the identity itself to pause, triggers stopped state
    function pause()
        public
        onlyManagementOrSelf
        whenNotPaused
    {
        paused = true;
        emit LogPause();
    }

      /// @dev called by a MANAGEMENT_KEY or the identity itself to unpause, returns to normal state
    function unpause()
        public
        onlyManagementOrSelf
        whenPaused
    {
        paused = false;
        emit LogUnpause();
    }
}
