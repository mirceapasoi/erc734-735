pragma solidity ^0.4.21;

import "../node_modules/zeppelin-solidity/contracts/ECRecovery.sol";
import "./Pausable.sol";
import "./ERC725.sol";
import "./ERC735.sol";
import "./ERC165Query.sol";

/// @title ClaimManager
/// @author Mircea Pasoi
/// @notice Implement functions from ERC735 spec
/// @dev Key data is stored in an array using KeyArray library. Inheriting ERC725 for the getters
contract ClaimManager is Pausable, ERC725, ERC735 {
    using ECRecovery for bytes32;
    using ERC165Query for address;

    bytes constant ETH_PREFIX = "\x19Ethereum Signed Message:\n32";

    struct Claim {
        uint256 claimType;
        uint256 scheme;
        address issuer; // msg.sender
        bytes signature; // this.address + claimType + data
        bytes data;
        string uri;
    }
    mapping(bytes32 => Claim) claims;
    mapping(uint256 => bytes32[]) claimsByType;
    uint public numClaims;

    /// @dev Checks if a given claim is valid
    /// @param _claimType Type of claim
    /// @param _scheme Scheme used for the signatures
    /// @param issuer Address of issuer
    /// @param _signature The actual signature
    /// @param _data The data that was signed
    /// @return `false` if the signature is invalid or if the scheme is not implemented
    function _validSignature(
        uint256 _claimType,
        uint256 _scheme,
        address issuer,
        bytes _signature,
        bytes _data
    )
        internal
        view
        returns (bool)
    {
        if (_scheme == ECDSA_SCHEME) {
            address signedBy = getSignatureAddress(claimToSign(address(this), _claimType, _data), _signature);
            if (issuer == signedBy) {
                // Issuer signed the signature
                return true;
            } else
            if (issuer == address(this)) {
                bool found;
                (, found) = allKeys.find(addrToKey(signedBy), CLAIM_SIGNER_KEY);
                return found;
            } else
            if (issuer.doesContractImplementInterface(ERC725ID())) {
                // Issuer is an Identity contract
                // It should hold the key with which the above message was signed.
                // If the key is not present anymore, the claim SHOULD be treated as invalid.
                uint256 purpose;
                (purpose, , ) = ERC725(issuer).getKey(addrToKey(signedBy), CLAIM_SIGNER_KEY);
                return (purpose == CLAIM_SIGNER_KEY);
            }
            // Invalid
            return false;
        }
        else {
            // Not implemented
            return false;
        }
    }

    /// @dev Modifier that only allows keys of purpose 1, the identity itself, or the issuer or the claim
    modifier onlyManagementOrSelfOrIssuer(bytes32 _claimId) {
        address issuer = claims[_claimId].issuer;
        // Must exist
        require(issuer != 0);

        bool valid = false;
        if (_managementOrSelf()) {
            valid = true;
        } else
        if (msg.sender == issuer) {
            // MUST only be done by the issuer of the claim
            valid = true;
        } else
        if (issuer.doesContractImplementInterface(ERC725ID())) {
            // Issuer is another Identity contract, is this an action key?
            uint256 purpose;
            (purpose, , ) = ERC725(issuer).getKey(addrToKey(msg.sender), ACTION_KEY);
            valid = (purpose == ACTION_KEY);
        }
        // Can perform action on claim
        require(valid);
        _;
    }

    /// @dev Add key data to the identity without checking if it already exists
    /// @param _claimId Claim ID
    /// @param _claimType Type of claim
    /// @param _scheme Scheme used for the signatures
    /// @param issuer Address of issuer
    /// @param _signature The actual signature
    /// @param _data The data that was signed
    /// @param _uri The location of the claim
    function _addClaim(
        bytes32 _claimId,
        uint256 _claimType,
        uint256 _scheme,
        address issuer,
        bytes _signature,
        bytes _data,
        string _uri
    )
        internal
    {
        // New claim
        claims[_claimId] = Claim(_claimType, _scheme, issuer, _signature, _data, _uri);
        claimsByType[_claimType].push(_claimId);
        numClaims++;
        emit ClaimAdded(_claimId, _claimType, _scheme, issuer, _signature, _data, _uri);
    }

    /// @dev Update the URI of an existing claim without any checks
    /// @param _claimType Type of claim
    /// @param issuer Address of issuer
    /// @param _uri The location of the claim
    function _updateClaimUri(
        uint256 _claimType,
        address issuer,
        string _uri
    )
    internal
    {
        claims[getClaimId(issuer, _claimType)].uri = _uri;
    }

    /// @dev Requests the ADDITION or the CHANGE of a claim from an issuer.
    ///  Claims can requested to be added by anybody, including the claim holder itself (self issued).
    /// @param _claimType Type of claim
    /// @param _scheme Scheme used for the signatures
    /// @param issuer Address of issuer
    /// @param _signature The actual signature
    /// @param _data The data that was signed
    /// @param _uri The location of the claim
    /// @return claimRequestId COULD be send to the approve function, to approve or reject this claim
    function addClaim(
        uint256 _claimType,
        uint256 _scheme,
        address issuer,
        bytes _signature,
        bytes _data,
        string _uri
    )
        public
        whenNotPaused
        returns (uint256 claimRequestId)
    {
        // Check signature
        require(_validSignature(_claimType, _scheme, issuer, _signature, _data));
        // Check we can perform action
        bool noApproval = _managementOrSelf();

        if (!noApproval) {
            // SHOULD be approved or rejected by n of m approve calls from keys of purpose 1
            claimRequestId = this.execute(address(this), 0, msg.data);
            emit ClaimRequested(claimRequestId, _claimType, _scheme, issuer, _signature, _data, _uri);
            return;
        }

        bytes32 claimId = getClaimId(issuer, _claimType);
        if (claims[claimId].issuer == address(0)) {
            _addClaim(claimId, _claimType, _scheme, issuer, _signature, _data, _uri);
        } else {
            // Existing claim
            Claim storage c = claims[claimId];
            c.scheme = _scheme;
            c.signature = _signature;
            c.data = _data;
            c.uri = _uri;
            // You can't change issuer or claimType without affecting the claimId, so we
            // don't need to update those two fields
            emit ClaimChanged(claimId, _claimType, _scheme, issuer, _signature, _data, _uri);
        }
    }

    /// @dev Removes a claim. Can only be removed by the claim issuer, or the claim holder itself.
    /// @param _claimId Claim ID to remove
    /// @return `true` if the claim is found and removed
    function removeClaim(bytes32 _claimId)
        public
        whenNotPaused
        onlyManagementOrSelfOrIssuer(_claimId)
        returns (bool success)
    {
        Claim memory c = claims[_claimId];
        // Must exist
        require(c.issuer != address(0));
        // Remove from mapping
        delete claims[_claimId];
        // Remove from type array
        bytes32[] storage cTypes = claimsByType[c.claimType];
        for (uint i = 0; i < cTypes.length; i++) {
            if (cTypes[i] == _claimId) {
                cTypes[i] = cTypes[cTypes.length - 1];
                delete cTypes[cTypes.length - 1];
                cTypes.length--;
                break;
            }
        }
        // Decrement
        numClaims--;
        // Event
        emit ClaimRemoved(_claimId, c.claimType, c.scheme, c.issuer, c.signature, c.data, c.uri);
        return true;
    }

    /// @dev Returns a claim by ID
    /// @return (claimType, scheme, issuer, signature, data, uri) tuple with claim data
    function getClaim(bytes32 _claimId)
        public
        view
        returns (
        uint256 claimType,
        uint256 scheme,
        address issuer,
        bytes signature,
        bytes data,
        string uri
        )
    {
        Claim memory c = claims[_claimId];
        require(c.issuer != address(0));
        claimType = c.claimType;
        scheme = c.scheme;
        issuer = c.issuer;
        signature = c.signature;
        data = c.data;
        uri = c.uri;
    }

    /// @dev Returns claims by type
    /// @param _claimType Type of claims to return
    /// @return array of claim IDs
    function getClaimIdsByType(uint256 _claimType)
        public
        view
        returns(bytes32[] claimIds)
    {
        claimIds = claimsByType[_claimType];
    }

    /// @dev Return a claim by type and index in array of claims. Hack until newer version of
    ///  Solidity is out
    /// @return (claimType, scheme, issuer, signature, data, uri) tuple with claim data, with
    ///  bytes and string types coerced into bytes32
    function getClaimByTypeAndIndex(uint256 _claimType, uint256 _index)
        public
        view
        returns (
        uint256 claimType,
        uint256 scheme,
        address issuer,
        bytes32 signature,
        bytes32 data,
        bytes32 uri
        )
    {
        // TODO: Get rid of this when Solidity 0.4.22 is out
        // https://github.com/ethereum/solidity/issues/3270
        bytes32 claimId = claimsByType[_claimType][_index];
        bytes memory _signature;
        bytes memory _data;
        string memory _uri;
        (claimType, scheme, issuer, _signature, _data, _uri) = getClaim(claimId);
        // https://ethereum.stackexchange.com/questions/9142/how-to-convert-a-string-to-bytes32
        assembly {
            signature := mload(add(_signature, 32))
            data := mload(add(_data, 32))
            uri := mload(add(_uri, 32))
        }
    }

    /// @dev Refresh a given claim. If no longer valid, it will remove it
    /// @param _claimId Claim ID to refresh
    /// @return `true` if claim is still valid, `false` if it was invalid and removed
    function refreshClaim(bytes32 _claimId)
        public
        whenNotPaused
        onlyManagementOrSelfOrIssuer(_claimId)
        returns (bool)
    {
        // Must exist
        Claim memory c = claims[_claimId];
        require(c.issuer != address(0));
        // Check claim is still valid
        if (!_validSignature(c.claimType, c.scheme, c.issuer, c.signature, c.data)) {
            // Remove claim
            removeClaim(_claimId);
            return false;
        }

        // Return true if claim is still valid
        return true;
    }

    /// @dev Generate claim ID. Especially useful in tests
    /// @param issuer Address of issuer
    /// @param claimType Claim type
    /// @return Claim ID hash
    function getClaimId(address issuer, uint256 claimType)
        public
        pure
        returns (bytes32)
    {
        // TODO: Doesn't allow multiple claims from the same issuer with the same type
        // This is particularly inconvenient for self-claims (e.g. self-claim multiple labels)
        return keccak256(issuer, claimType);
    }

    /// @dev Generate claim to sign. Especially useful in tests
    /// @param subject Address about which we're making a claim
    /// @param claimType Claim type
    /// @param data Data for the claim
    /// @return Hash to be signed by claim issuer
    function claimToSign(address subject, uint256 claimType, bytes data)
        public
        pure
        returns (bytes32)
    {
        // TODO: Why is "uri" not included in signature?
        return keccak256(subject, claimType, data);
    }

    /// @dev Recover address used to sign a claim
    /// @param toSign Hash to be signed, potentially generated with `claimToSign`
    /// @param signature Signature data i.e. signed hash
    /// @return address recovered from `signature` which signed the `toSign` hash
    function getSignatureAddress(bytes32 toSign, bytes signature)
        public
        pure
        returns (address)
    {
        return keccak256(ETH_PREFIX, toSign).recover(signature);
    }
}