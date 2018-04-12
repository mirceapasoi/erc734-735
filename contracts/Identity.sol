pragma solidity ^0.4.21;

import "./Destructible.sol";
import "./ERC735.sol";
import "./KeyGetters.sol";
import "./KeyManager.sol";
import "./MultiSig.sol";
import "./ClaimManager.sol";

/// @title Identity
/// @author Mircea Pasoi
/// @notice Identity contract implementing both ERC 725 and ERC 735
contract Identity is Destructible, KeyManager, KeyGetters, MultiSig, ClaimManager {
    /// @dev Constructor for Identity contract. If no initial keys are passed then
    ///  `msg.sender` is used as an initial MANAGEMENT_KEY, ACTION_KEY and CLAIM_SIGNER_KEY
    /// @param _keys Keys to start contract with, in ascending order; in case of equality, purposes must be ascending
    /// @param _purposes Key purposes (in the same order as _keys)
    /// @param _keyTypes Key types (in the same order as _keys)
    /// @param _managementThreshold Multi-sig threshold for MANAGEMENT_KEY
    /// @param _actionThreshold Multi-sig threshold for ACTION_KEY
    function Identity(
        bytes32[] _keys,
        uint256[] _purposes,
        uint256[] _keyTypes,
        uint256 _managementThreshold,
        uint256 _actionThreshold
        // TODO: Pass bytes[] signatures, bytes[] data and string[] uris once ABIEncoderV2 is out
    )
        public
    {
        require(_managementThreshold > 0);
        require(_actionThreshold > 0);
        // Validate keys are sorted and unique
        require(_keys.length == _purposes.length);
        require(_purposes.length == _keyTypes.length);
        for (uint i = 1; i < _keys.length; i++) {
            // Expect input to be in sorted order, first by keys, then by purposes
            // Sorted order guarantees (key, purpose) pairs are unique and we can use
            // _addKey insteaad of addKey (which also checks for existance)
            bytes32 prevKey = _keys[i - 1];
            require(_keys[i] > prevKey || (_keys[i] == prevKey && _purposes[i] > _purposes[i - 1]));
        }

        // Supports both ERC 725 & 735
        supportedInterfaces[ERC725ID() ^ ERC735ID()] = true;

        uint256 actionCount;
        uint256 managementCount;
        if (_keys.length == 0) {
            bytes32 senderKey = addrToKey(msg.sender);
            // Add key that deployed the contract for MANAGEMENT, ACTION, CLAIM
            _addKey(senderKey, MANAGEMENT_KEY, ECDSA_TYPE);
            _addKey(senderKey, ACTION_KEY, ECDSA_TYPE);
            _addKey(senderKey, CLAIM_SIGNER_KEY, ECDSA_TYPE);
            actionCount = 1;
            managementCount = 1;
        } else {
            // Add constructor keys
            for (i = 0; i < _keys.length; i++) {
                _addKey(_keys[i], _purposes[i], _keyTypes[i]);
                if (_purposes[i] == MANAGEMENT_KEY) {
                    managementCount++;
                } else
                if (_purposes[i] == ACTION_KEY) {
                    actionCount++;
                }
            }
        }

        require(_managementThreshold <= managementCount);
        require(_actionThreshold <= actionCount);
        managementThreshold = _managementThreshold;
        actionThreshold = _actionThreshold;
    }

    // Fallback function accepts Ether transactions
    function () external payable {
    }
}