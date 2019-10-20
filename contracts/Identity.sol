pragma solidity ^0.5.12;

pragma experimental ABIEncoderV2;

import "./Destructible.sol";
import "./ERC735.sol";
import "./KeyGetters.sol";
import "./KeyManager.sol";
import "./MultiSig.sol";
import "./ClaimManager.sol";

/// @title Identity
/// @author Mircea Pasoi
/// @notice Identity contract implementing both ERC 725 and ERC 735

contract Identity is KeyManager, MultiSig, ClaimManager, Destructible, KeyGetters {
    /// @dev Constructor for Identity contract. If no initial keys are passed then
    ///  `msg.sender` is used as an initial MANAGEMENT_KEY, EXECUTION_KEY and CLAIM_SIGNER_KEY
    /// @param _keys Keys to start contract with, in ascending order; in case of equality, purposes must be ascending
    /// @param _purposes Key purposes (in the same order as _keys)
    /// @param _issuers Claim issuers to start contract with, in ascending order; in case of equality, topics must be ascending
    /// @param _managementRequired Multi-sig threshold for MANAGEMENT_KEY
    /// @param _executionRequired Multi-sig threshold for EXECUTION_KEY
    /// @param _topics Claim topics (in the same order as _issuers)
    /// @param _signatures All the initial claim signatures
    /// @param _datas All the initial claim data
    /// @param _uris All the initial claim URIs
    constructor
    (
        bytes32[] memory _keys,
        uint256[] memory _purposes,
        uint256 _managementRequired,
        uint256 _executionRequired,
        address[] memory _issuers,
        uint256[] memory _topics,
        bytes[] memory _signatures,
        bytes[] memory _datas,
        string[] memory _uris
    )
    public {
        _validateKeys(_keys, _purposes);
        _validateClaims(_issuers, _topics);

        _addKeys(_keys, _purposes, _managementRequired, _executionRequired);
        _addClaims(_issuers, _topics, _signatures, _datas, _uris);

        // Supports both ERC 725 & 735
        supportedInterfaces[ERC725ID() ^ ERC735ID()] = true;
    }

    // Fallback function accepts Ether transactions
    // solhint-disable-next-line no-empty-blocks
    function () external payable {
    }

    /// @dev Validate keys are sorted and unique
    /// @param _keys Keys to start contract with, in ascending order; in case of equality, purposes must be ascending
    /// @param _purposes Key purposes (in the same order as _keys)
    function _validateKeys
    (
        bytes32[] memory _keys,
        uint256[] memory _purposes
    )
    private
    pure
    {
        // Validate keys are sorted and unique
        require(_keys.length == _purposes.length, "keys length != purposes length");
        for (uint i = 1; i < _keys.length; i++) {
            // Expect input to be in sorted order, first by keys, then by purposes
            // Sorted order guarantees (key, purpose) pairs are unique and we can use
            // _addKey insteaad of addKey (which also checks for existance)
            bytes32 prevKey = _keys[i - 1];
            require(_keys[i] > prevKey || (_keys[i] == prevKey && _purposes[i] > _purposes[i - 1]), "keys not sorted");
        }
    }

    /// @dev Add keys to contract and set multi-sig thresholds
    /// @param _keys Keys to start contract with, in ascending order; in case of equality, purposes must be ascending
    /// @param _purposes Key purposes (in the same order as _keys)
    /// @param _managementRequired Multi-sig threshold for MANAGEMENT_KEY
    /// @param _executionRequired Multi-sig threshold for EXECUTION_KEY
    function _addKeys
    (
        bytes32[] memory _keys,
        uint256[] memory _purposes,
        uint256 _managementRequired,
        uint256 _executionRequired
    )
    private
    {
        uint256 executionCount;
        uint256 managementCount;
        if (_keys.length == 0) {
            bytes32 senderKey = addrToKey(msg.sender);
            // Add key that deployed the contract for MANAGEMENT, EXECUTION, CLAIM
            _addKey(senderKey, MANAGEMENT_KEY, ECDSA_TYPE);
            _addKey(senderKey, EXECUTION_KEY, ECDSA_TYPE);
            _addKey(senderKey, CLAIM_SIGNER_KEY, ECDSA_TYPE);
            executionCount = 1;
            managementCount = 1;
        } else {
            // Add constructor keys
            for (uint i = 0; i < _keys.length; i++) {
                _addKey(_keys[i], _purposes[i], ECDSA_TYPE);
                if (_purposes[i] == MANAGEMENT_KEY) {
                    managementCount++;
                } else
                if (_purposes[i] == EXECUTION_KEY) {
                    executionCount++;
                }
            }
        }

        require(_managementRequired > 0, "management threshold too low");
        require(_managementRequired <= managementCount, "management threshold too high");
        require(_executionRequired > 0, "execution threshold too low");
        require(_executionRequired <= executionCount, "execution threshold too high");
        managementRequired = _managementRequired;
        executionRequired = _executionRequired;
    }

    /// @dev Validate claims are sorted and unique
    /// @param _issuers Claim issuers to start contract with, in ascending order; in case of equality, topics must be ascending
    /// @param _topics Claim topics (in the same order as _issuers)
    function _validateClaims
    (
        address[] memory _issuers,
        uint256[] memory _topics
    )
    private
    pure
    {
        // Validate claims are sorted and unique
        require(_issuers.length == _topics.length, "issuers length != topics length");
        for (uint i = 1; i < _issuers.length; i++) {
            // Expect input to be in sorted order, first by issuer, then by topic
            // Sorted order guarantees (issuer, topic) pairs are unique
            address prevIssuer = _issuers[i - 1];
            require(_issuers[i] != prevIssuer || (_issuers[i] == prevIssuer && _topics[i] > _topics[i - 1]), "issuers not sorted");
        }
    }

    /// @dev Add claims to contract without an URI
    /// @param _issuers Claim issuers to start contract with, in ascending order; in case of equality, topics must be ascending
    /// @param _topics Claim topics (in the same order as _issuers)
    /// @param _signatures All the initial claim signatures
    /// @param _datas All the initial claim data
    /// @param _uris All the initial claim URIs
    function _addClaims
    (
        address[] memory _issuers,
        uint256[] memory _topics,
        bytes[] memory _signatures,
        bytes[] memory _datas,
        string[] memory _uris
    )
    private
    {
        for (uint i = 0; i < _issuers.length; i++) {
            // Check signature
            require(_validSignature(
                _topics[i],
                ECDSA_SCHEME,
                _issuers[i],
                _signatures[i],
                _datas[i]
            ), "addClaims signature invalid");
            // Add claim
            _addClaim(
                getClaimId(_issuers[i], _topics[i]),
                _topics[i],
                ECDSA_SCHEME,
                _issuers[i],
                _signatures[i],
                _datas[i],
                _uris[i]
            );
        }
    }
}