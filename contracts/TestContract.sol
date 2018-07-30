pragma solidity ^0.4.24;

import "./ERC165Query.sol";
import "./ERC735.sol";

/// @title TestContract
/// @author Mircea Pasoi
/// @dev Contract used in unit tests

contract TestContract {
    // Implements ERC165
    using ERC165Query for address;

    // Events
    event IdentityCalled(bytes data);

    // Counts calls by msg.sender
    mapping (address => uint) public numCalls;

    /// @dev Increments the number of calls from sender
    function callMe() external {
        numCalls[msg.sender] += 1;
    }

    /// @dev Expects to be called by an ERC735 contract and it will emit the label
    ///  of the first LABEL claim in that contract
    function whoCalling() external {
        // ERC735
        require(msg.sender.doesContractImplementInterface(0x10765379));
        // Get first LABEL claim
        ERC735 id = ERC735(msg.sender);
        // 5 is LABEL_TOPIC
        bytes32[] memory claimIds = id.getClaimIdsByType(5);
        bytes memory data;
        (, , , , data, ) = id.getClaim(claimIds[0]);
        emit IdentityCalled(data);
    }
}
