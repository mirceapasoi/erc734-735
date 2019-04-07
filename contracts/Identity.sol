pragma solidity ^0.5.7;

import "./Destructible.sol";
import "./ERC735.sol";
import "./KeyGetters.sol";
import "./KeyManager.sol";
import "./MultiSig.sol";
import "./ClaimManager.sol";
import "./Slice.sol";

/// @title Identity
/// @author Mircea Pasoi
/// @notice Identity contract implementing both ERC 725 and ERC 735

contract Identity is KeyManager, MultiSig, ClaimManager, Destructible, KeyGetters {
    using Slice for bytes;
    using Slice for string;

    /// @dev Constructor for Identity contract. If no initial keys are passed then
    ///  `msg.sender` is used as an initial MANAGEMENT_KEY, ACTION_KEY and CLAIM_SIGNER_KEY
    /// @param _keys Keys to start contract with, in ascending order; in case of equality, purposes must be ascending
    /// @param _purposes Key purposes (in the same order as _keys)
    /// @param _issuers Claim issuers to start contract with, in ascending order; in case of equality, topics must be ascending
    /// @param _managementThreshold Multi-sig threshold for MANAGEMENT_KEY
    /// @param _actionThreshold Multi-sig threshold for ACTION_KEY
    /// @param _topics Claim topics (in the same order as _issuers)
    /// @param _signatures All the initial claim signatures concatenated in one bytes array
    /// @param _datas All the initial claim data concatenated in one bytes array
    /// @param _uris All the initial claim URIs concatenated in one string
    /// @param _sizes Triples of signature, claim data, URI sizes (each must be ≤ 256)
    constructor
    (
        bytes32[] memory _keys,
        uint256[] memory _purposes,
        uint256 _managementThreshold,
        uint256 _actionThreshold,
        address[] memory _issuers,
        uint256[] memory _topics,
        // TODO: Pass bytes[] signatures, bytes[] data and string[] uris once ABIEncoderV2 is out
        bytes memory _signatures,
        bytes memory _datas,
        string memory _uris,
        uint8[] memory _sizes
    )
    public {
        _validateKeys(_keys, _purposes);
        _validateClaims(_issuers, _topics, _sizes);

        _addKeys(_keys, _purposes, _managementThreshold, _actionThreshold);
        _addClaims(_issuers, _topics, _signatures, _datas, _uris, _sizes);

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
    /// @param _managementThreshold Multi-sig threshold for MANAGEMENT_KEY
    /// @param _actionThreshold Multi-sig threshold for ACTION_KEY
    function _addKeys
    (
        bytes32[] memory _keys,
        uint256[] memory _purposes,
        uint256 _managementThreshold,
        uint256 _actionThreshold
    )
    private
    {
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
            for (uint i = 0; i < _keys.length; i++) {
                _addKey(_keys[i], _purposes[i], ECDSA_TYPE);
                if (_purposes[i] == MANAGEMENT_KEY) {
                    managementCount++;
                } else
                if (_purposes[i] == ACTION_KEY) {
                    actionCount++;
                }
            }
        }

        require(_managementThreshold > 0, "management threshold too low");
        require(_managementThreshold <= managementCount, "management threshold too high");
        require(_actionThreshold > 0, "action threshold too low");
        require(_actionThreshold <= actionCount, "action threshold too high");
        managementThreshold = _managementThreshold;
        actionThreshold = _actionThreshold;
    }

    /// @dev Validate claims are sorted and unique
    /// @param _issuers Claim issuers to start contract with, in ascending order; in case of equality, topics must be ascending
    /// @param _topics Claim topics (in the same order as _issuers)
    /// @param _sizes Triples of signature, claim data, URI sizes (each must be ≤ 256)
    function _validateClaims
    (
        address[] memory _issuers,
        uint256[] memory _topics,
        uint8[] memory _sizes
    )
    private
    pure
    {
        // Validate claims are sorted and unique
        require(_issuers.length == _topics.length, "issuers length != topics length");
        require(3 * _topics.length == _sizes.length, "topics length != sizes length");
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
    /// @param _signatures All the initial claim signatures concatenated in one bytes array
    /// @param _datas All the initial claim data concatenated in one bytes array
    /// @param _uris All the initial claim URIs concatenated in one string
    /// @param _sizes Triples of signature, claim data, URI sizes (each must be ≤ 256)
    function _addClaims
    (
        address[] memory _issuers,
        uint256[] memory _topics,
        bytes memory _signatures,
        bytes memory _datas,
        string memory _uris,
        uint8[] memory _sizes
    )
    private
    {
        // Add constructor claims
        uint[3] memory offset;
        bytes memory signature;
        bytes memory data;
        for (uint i = 0; i < _issuers.length; i++) {
            // Check signature
            signature = _signatures.slice(offset[0], _sizes[3 * i]);
            data = _datas.slice(offset[1], _sizes[3 * i + 1]);
            require(_validSignature(_topics[i], ECDSA_SCHEME, _issuers[i], signature, data), "addClaims signature invalid");
            // Add claim
            _addClaim(
                getClaimId(_issuers[i], _topics[i]),
                _topics[i],
                ECDSA_SCHEME,
                _issuers[i],
                signature,
                data,
                _uris.slice(offset[2], _sizes[3 * i + 2])
            );
            offset[0] += _sizes[3 * i];
            offset[1] += _sizes[3 * i + 1];
            offset[2] += _sizes[3 * i + 2];
        }
    }
}