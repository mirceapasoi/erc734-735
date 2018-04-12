const Identity = artifacts.require("Identity");
import colors from 'colors';
import { assertOkTx, getAndClearGas, measureTx, contractAddress } from './util';

// Constants
export const Purpose = {
    MANAGEMENT: 1,
    ACTION: 2,
    CLAIM: 3,
    ENCRYPT: 4
};

export const KeyType = {
    ECDSA: 1,
};

export const ClaimType = {
    BIOMETRIC: 1,
    RESIDENCE: 2,
    REGISTRY: 3,
    PROFILE: 4,
    LABEL: 5
}

export const Scheme = {
    ECDSA: 1,
    RSA: 2,
    CONTRACT: 3
}

export const assertKeyCount = async (identity, purpose, count) => {
    let keys = await identity.getKeysByPurpose(purpose);
    assert.equal(keys.length, count);
};

// Setup test environment
export const setupTest = async (accounts, init, total, claims = [], managementThreshold = 1, actionThreshold = 1) => {
    let totalSum = total.reduce((a, b) => a + b);
    let initSum = init.reduce((a, b) => a + b);
    let addr = {}, keys = {};

    // Check we have enough accounts
    assert(initSum <= totalSum && totalSum + 1 <= accounts.length, "Not enough accounts");

    // Use deployed identity for other identity
    let otherIdentity = await Identity.deployed();
    addr.other = accounts[0];
    keys.other = await otherIdentity.addrToKey(accounts[0]);

    // Slice accounts (0 is used above) and generate keys using keccak256
    let accountTuples = [];
    for (let addr of accounts.slice(1)) {
        let key = await otherIdentity.addrToKey(addr);
        accountTuples.push([addr, key]);
    }
    // Sort by keys (useful for identity constructor)
    accountTuples.sort((a, b) => a[1].localeCompare(b[1]));
    // Put keys in maps
    const idxToPurpose = ['manager', 'action', 'claim', 'encrypt'];
    for (let i = 0, j = 0; i < total.length; i++) {
        // Slice total[i] accounts
        let slice = accountTuples.slice(j, j + total[i]);
        j += total[i];
        let purpose = idxToPurpose[i];
        addr[purpose] = slice.map(a => a[0]);
        keys[purpose] = slice.map(a => a[1]);
    }

    // Init keys to be sent in constructor
    let initKeys = [], initPurposes = [];
    for (let i = 0; i < init.length; i++) {
        let purpose = idxToPurpose[i];
        let k = keys[purpose].slice(0, init[i]);
        let p = Array(init[i]).fill(i + 1); // Use numeric value for purpose
        initKeys = initKeys.concat(k);
        initPurposes = initPurposes.concat(p);
    }

    // Init self-claims to be sent in constructor
    let willDeployAt = contractAddress(addr.manager[0]);
    let signatures = [];
    if (claims.length > 0) {
        // Must have at least one claim address if making claim
        assert(addr.claim.length > 0);
        for (const { type, data, self } of claims) {
            // Claim hash
            let toSign = await otherIdentity.claimToSign(willDeployAt, type, data);
            // Sign using CLAIM_SIGNER_KEY
            let claimSigner = self ? addr.claim[0] : addr.other;
            let signature = web3.eth.sign(claimSigner, toSign);
            signatures.push(signature);
        }
    }

    // Deploy identity
    let identity = await Identity.new(
        initKeys,
        initPurposes,
        Array(initSum).fill(KeyType.ECDSA),
        managementThreshold,
        actionThreshold,
        {from: addr.manager[0]}
    );
    // Make sure it matches address used for signatures
    assert.equal(identity.address, willDeployAt);
    // Measure gas usage
    await measureTx(identity.transactionHash);

    // Add self-laims one by one, until ABIEncoderV2 works and we can send them through the constructor
    for (let i = 0; i < claims.length; i++) {
        const { type, data, uri, self } = claims[i];
        let issuer = self ? identity.address : otherIdentity.address;
        await assertOkTx(identity.addClaim(type, Scheme.ECDSA, issuer, signatures[i], data, uri, {from: addr.manager[0]}));
    }

    // Check init keys
    let contractKeys = await identity.numKeys();
    contractKeys.should.be.bignumber.equal(initSum);
    // Check init claims
    let contractClaims = await identity.numClaims();
    contractClaims.should.be.bignumber.equal(claims.length);

    console.debug(`Setup: ${getAndClearGas().toLocaleString()} gas (${initSum}/${totalSum} keys, ${contractClaims} claims)`.grey);

    return {
        identity,
        addr,
        keys,
        otherIdentity
    }
}