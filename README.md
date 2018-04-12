# ERC 725 + 735

This is an attempt at an implementation of [ERC 725](https://github.com/ethereum/EIPs/issues/725) and [ERC 735](https://github.com/ethereum/EIPs/issues/735), following the specs as closely as possible. It uses the [Truffle framework](http://truffleframework.com/) and [Ganache CLI](https://github.com/trufflesuite/ganache-cli) for testing.

## Overview

The smart contract implements the following features:

1. deploy contract using initial set of keys (`Identity.sol`)
2. add/remove keys to identity (`KeyManager.sol`)
3. get key data, in multiple ways (`KeyGetters.sol`)
4. "proxy contract" execution on the blockchain (`MultiSig.sol`)
5. multi-signature mechanism for MANAGEMENT_KEY and ACTION_KEY (`MultiSig.sol`)
6. add/remove claims to identity (`ClaimManager.sol`)
7. get claim data, in multiple ways (`ClaimManager.sol`)
8. refresh claims in identity (`ClaimManager.sol`)
9. ability to pause/unpause the contract, potentially with multi-sig (`Pausable.sol`)
10. ability to destroy the contract and return funds, potentially with multi-sig (`Destructible.sol`)

## Architecture

The implementation tries to make extensive use of Solidity patterns for modular code i.e. libraries, abstract contracts and multiple inheritence. Here's how the class diagram looks:

```
                                         +------------+
                                         |            |
                                         | KeyArray** |
                                         |            |
                                         +----+-------+
                                              |
               +----------+ +----------+ +----v-----+
               |          | |          | |          |
 +-------------+ ERC 735* | | ERC 725* | | KeyBase* |
 |             |          | |          | |          |
 |             +----------+ ++-+----+--+ +--+-------+------+--------------+
 |                           | |    |       |              |              |
 |                           | |    |       |              |              |
 |   +-----------------------+ |    | +-----+-----+  +-----v-----+ +------v-------+
 |   |                         |    | |           |  |           | |              |
 |   |                 +--------------+ Pausable  |  | KeyGetter | | Destructible |
 |   |    +---------------------------+           |  |           | |              |
 |   |    |            |       |    | +--+--------+  +-+---------+ +--+-----------+
 |   |    |            |  +----+    |    |             |              |
 |   |    |            |  |         |    |             |              |
 |   |    |            |  |         |    |             |              |
 |   |    |            |  |         |    |             |              |
+v---v----v---+ +------v--v---+  +--v----v--+          |              |
|             | |             |  |          |          |              |
| ClaimManager| | KeyManager  |  | MultiSig |          |              |
|             | |             |  |          |          |              |
+---+---------+ ++------------+  +--+-------+          |              |
    |            |                  |                  |              |
    |            |                  |                  |              |
    |            |        +---------v------------------v---+          |
    |            |        |                                <----------+
    |            +-------->            Identity            |
    |                     |        (ERC 725 + 735)         |
    +--------------------->                                |
                          +--------------------------------+

* = Abstract contract
** = Library
```

## Tests

Truffle tests exists for each contract, in separate files in the `test/` folder. Each tests tries to count how much gas it's using for setup and during the test. Also, at the end I'm printing out
total gas used for all tests.
```
$ truffle test
...
Setup: 5,825,603 gas (4/6 keys, 0 claims)
    ✓ should be paused/unpaused by management keys (80ms)
Test: 60,502 gas
Total: 5,215,118 gas
  47 passing (53s)
```

Currently missing unit tests for events being emitted.

## Open issues
1. Can't use `getClaim` and `getClaimIdsByType` in smart contracts until Solidity 0.4.22 is out because they use variable length types `bytes`  and `string` (details here https://github.com/ethereum/solidity/issues/3270). As a temporary measure, I've added a `getClaimByTypeAndIndex(_claimId, _index)` that bypasses the issues and coerces variable length types into `bytes32`.
2. Can't pass an initial set of claims on contract deploy, seems like `ABIEncodeV2` is needed to have `bytes[] signatures, bytes[] data, string[] uris` in the constructor.
3. `uri` is not included in the signature and could theoretically be changed without changing a claim signature. Is this intentional or not?
4. Claim IDs are generated using `keccak256(address issuer + uint256 _claimType)`, which doesn't work great for self-claims i.e. `issuer` is `address(this)` and we might want multiple self-claims with the same `claimType`
5. Added an `ExecutionFailed` event in `ERC725` which isn't part of the standard
6. For execution requests, I'm using the multi-sig threshold at the time of request, not the one at the time of execution - is that a good idea? (e.g. you request an execution, threshold is `X`, wait for approvals, threshold is increased to `Y`, initial execution is approval with `X` approvals)
7. Added a `PROFILE_CLAIM` claim type which isn't part of the standard. The intended use is to store a plain-text profile URL in `data` (social media, blogs, etc.). As a convention, `uri` should be equal to `data`.
8. Added a `LABEL_CLAIM` claim type which isn't part of the standard. The intended use is to stora a plain-text label in `data` (real name, business name, nick name, brand name, alias, etc.).
9. The "proxy contract" only supports `.call`, doesn't support `.delegateacall` or creating a new contract on behalf of the identity.