const Identity = artifacts.require("Identity");
import { expect } from 'chai';
import { getAndClearGas, measureTx, contractAddress, assertBlockGasLimit, fixSignature } from './util';

// Constants
export const Purpose = {
    MANAGEMENT: 1,
    EXECUTION: 2,
    CLAIM: 3,
    ENCRYPT: 4
};

export const KeyType = {
    ECDSA: 1,
};

export const Topic = {
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

export const utf8ToBytes = (s) => {
    return web3.utils.hexToBytes(web3.utils.utf8ToHex(s))
}

export const assertKeyCount = async (identity, purpose, count) => {
    let keys = await identity.getKeysByPurpose(purpose);
    assert.equal(keys.length, count, "key count mismatch");
};

// Setup test environment
export const setupTest = async (accounts, init, total, claims = [], managementRequired = 1, executionRequired = 1, blockGasLimit = 10000000) => {
    let totalSum = total.reduce((a, b) => a + b);
    let initSum = init.reduce((a, b) => a + b);
    let addr = {}, keys = {};

    // Check we have enough accounts
    assert(initSum <= totalSum && totalSum + 1 <= accounts.length, "Not enough accounts");

    // Check block gas limit is appropriate
    await assertBlockGasLimit(blockGasLimit);

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
    const idxToPurpose = ['manager', 'execution', 'claim', 'encrypt'];
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
    let willDeployAt = await contractAddress(addr.manager[0]);
    let signatures = [];
    let datas = [];
    if (claims.length > 0) {
        // Must have at least one claim address if making claim
        assert(addr.claim.length > 0);
        // First, sort claims by issuer, topic
        claims.sort((c1, c2) => {
            if (c1.self == c2.self) return c1.type - c2.type;
            let a1 = c1.self ? willDeployAt : otherIdentity.address;
            let a2 = c2.self ? willDeployAt : otherIdentity.address;
            return a1.localeCompare(a2);
        });
        for (const { type, data, self } of claims) {
            let dataHex = web3.utils.utf8ToHex(data);
            // Claim hash
            let toSign = await otherIdentity.claimToSign(willDeployAt, type, dataHex);
            // Sign using CLAIM_SIGNER_KEY
            let claimSigner = self ? addr.claim[0] : addr.other;
            let signature = fixSignature(await web3.eth.sign(toSign, claimSigner));
            // Get bytes array
            signatures.push(web3.utils.hexToBytes(signature));
            datas.push(web3.utils.hexToBytes(dataHex));
        }
    }

    // Deploy identity
    let identity = await Identity.new(
        // Keys
        initKeys,
        initPurposes,
        // Thresholds
        managementRequired,
        executionRequired,
        // Claims
        claims.map(c => c.self ? willDeployAt : otherIdentity.address),
        claims.map(c => c.type),
        signatures,
        datas,
        claims.map(c => c.uri),
        // Use max gas for deploys
        {from: addr.manager[0], gas: blockGasLimit}
    );
    // Make sure it matches address used for signatures
    assert.equal(identity.address, willDeployAt, "Deployed address does not match");
    // Measure gas usage
    await measureTx(identity.transactionHash);

    // Check init keys
    let contractKeys = await identity.numKeys();
    expect(contractKeys).to.be.bignumber.equal(initSum.toString());
    // Check init claims
    let contractClaims = await identity.numClaims();
    expect(contractClaims).to.be.bignumber.equal(claims.length.toString());

    getAndClearGas();

    return {
        identity,
        addr,
        keys,
        otherIdentity
    }
}