// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "./ERC165.sol";

/// @title ERC734
/// @author Mircea Pasoi
/// @notice Abstract contract for ERC734

abstract contract ERC734 is ERC165 {
    /// @dev Constructor that adds ERC734 as a supported interface
    constructor() {
        supportedInterfaces[ERC734ID()] = true;
    }

    /// @dev ID for ERC165 pseudo-introspection
    /// @return ID for ERC734 interface
    // solhint-disable-next-line func-name-mixedcase
    function ERC734ID() public pure returns (bytes4) {
        return (
            this.getKey.selector ^ this.keyHasPurpose.selector ^
            this.getKeysByPurpose.selector ^
            this.addKey.selector ^ this.removeKey.selector ^
            this.execute.selector ^ this.approve.selector ^
            this.changeKeysRequired.selector ^ this.getKeysRequired.selector
        );
    }

    // Purpose
    // 1: MANAGEMENT keys, which can manage the identity
    uint256 public constant MANAGEMENT_KEY = 1;
    // 2: EXECUTION keys, which perform actions in this identities name (signing, logins, transactions, etc.)
    uint256 public constant EXECUTION_KEY = 2;
    // 3: CLAIM signer keys, used to sign claims on other identities which need to be revokable.
    uint256 public constant CLAIM_SIGNER_KEY = 3;
    // 4: ENCRYPTION keys, used to encrypt data e.g. hold in claims.
    uint256 public constant ENCRYPTION_KEY = 4;

    // KeyType
    uint256 public constant ECDSA_TYPE = 1;
    // https://medium.com/@alexberegszaszi/lets-bring-the-70s-to-ethereum-48daa16a4b51
    uint256 public constant RSA_TYPE = 2;

    // Events
    event KeyAdded(bytes32 indexed key, uint256 indexed purpose, uint256 indexed keyType);
    event KeyRemoved(bytes32 indexed key, uint256 indexed purpose, uint256 indexed keyType);
    event ExecutionRequested(uint256 indexed executionId, address indexed to, uint256 indexed value, bytes data);
    event Executed(uint256 indexed executionId, address indexed to, uint256 indexed value, bytes data);
    event Approved(uint256 indexed executionId, bool approved);
    event KeysRequiredChanged(uint256 indexed purpose, uint256 indexed number);
    // TODO: Extra event, not part of the standard
    event ExecutionFailed(uint256 indexed executionId, address indexed to, uint256 indexed value, bytes data);

    // Functions
    function getKey(bytes32 _key) public view virtual returns(uint256[] memory purposes, uint256 keyType, bytes32 key);
    function keyHasPurpose(bytes32 _key, uint256 purpose) public view virtual returns(bool exists);
    function getKeysByPurpose(uint256 _purpose) public view virtual returns(bytes32[] memory keys);
    function addKey(bytes32 _key, uint256 _purpose, uint256 _keyType) public virtual returns (bool success);
    function removeKey(bytes32 _key, uint256 _purpose) public virtual returns (bool success);
    function changeKeysRequired(uint256 purpose, uint256 number) external virtual;
    function getKeysRequired(uint256 purpose) external view virtual returns(uint256);
    function execute(address _to, uint256 _value, bytes memory _data) public virtual returns (uint256 executionId);
    function approve(uint256 _id, bool _approve) public virtual returns (bool success);
}