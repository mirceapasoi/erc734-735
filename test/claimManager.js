import { shouldFail } from 'openzeppelin-test-helpers';
import { setupTest, utf8ToBytes, Purpose, Topic, Scheme } from './base';
import { printTestGas, assertOkTx, fixSignature } from './util';
import { expect } from 'chai';

const TestContract = artifacts.require("TestContract");

contract("ClaimManager", async (accounts) => {
    let identity, otherIdentity, addr, keys;

    afterEach("print gas", printTestGas);

    const assertClaim = async (_topic, _issuer, _signature, _data, _uri) => {
        let claimId = await identity.getClaimId(_issuer, _topic);
        const {topic, scheme, issuer, signature, data, uri} = await identity.getClaim(claimId);

        expect(topic).to.be.bignumber.equal(_topic.toString());
        expect(scheme).to.be.bignumber.equal(Scheme.ECDSA.toString());
        assert.equal(issuer, _issuer);
        assert.equal(signature, _signature);
        assert.equal(data, _data);
        assert.equal(uri, _uri);
    }

    const assertClaims = async (_total, _types) => {
        // Check total
        let total = await identity.numClaims();
        expect(total).to.be.bignumber.equal(_total.toString());

        // Check per type
        for (let type of Object.keys(_types)) {
            let ids = await identity.getClaimIdsByType(type);
            // Check length
            assert.equal(ids.length, _types[type]);
        }
    }

    const findClaimRequestId = (r) => {
        return r.logs.find(e => e.event == 'ClaimRequested').args.claimRequestId;
    }

    beforeEach("new contract", async () => {
        ({ identity, addr, keys, otherIdentity } = await setupTest(
            accounts,
            [2, 2, 1, 0],
            [3, 3, 1, 0],
            [
                {type: Topic.LABEL, data: 'Mircea Pasoi', uri: 'http://mirceapasoi.com', self: true},
                {type: Topic.LABEL, data: 'Mircea Bogdan Pasoi', uri: '', self: false},
            ]
        ));
    });

    describe("addClaim", () => {
        it("can recover signature", async () => {
            let label = web3.utils.utf8ToHex("test");
            // Claim hash (contract)
            let toSign = await identity.claimToSign(identity.address, Topic.LABEL, label);
            // Claim hash (web3)
            let web3ToSign = web3.utils.soliditySha3(
                {t: 'address', v: identity.address},
                {t: 'uint256', v: Topic.LABEL},
                {t: 'bytes', v: label}
            );
            assert.equal(toSign, web3ToSign);
            // Sign using eth_sign
            let signature = fixSignature(await web3.eth.sign(toSign, addr.manager[0]));
            // Recover address from signature (web3)
            let signedBy = await web3.eth.accounts.recover(toSign, signature);
            assert.equal(signedBy, addr.manager[0]);
            // Recover address from signature (contract)
            signedBy = await identity.getSignatureAddress(toSign, signature);
            assert.equal(signedBy, addr.manager[0]);
        });

        it("can add self-claim as manager", async () => {
            let uri = "https://twitter.com/mirceap";
            let label = web3.utils.utf8ToHex(uri);
            // Claim hash
            let toSign = await identity.claimToSign(identity.address, Topic.PROFILE, label);
            // Sign using CLAIM_SIGNER_KEY
            let signature = fixSignature(await web3.eth.sign(toSign, addr.claim[0]));

            // Add self-claim as manager
            await assertOkTx(identity.addClaim(Topic.PROFILE, Scheme.ECDSA, identity.address, signature, label, uri, {from: addr.manager[0]}));

            // Check claim
            await assertClaim(Topic.PROFILE, identity.address, signature, label, uri);

            await assertClaims(3, {[Topic.LABEL]: 2, [Topic.PROFILE]: 1});
        });

        it("checks signature when adding", async () => {
            let uri = "https://twitter.com/mirceap";
            let label = web3.utils.utf8ToHex(uri);
            // Claim hash
            let toSign = await identity.claimToSign(identity.address, Topic.PROFILE, label);
            // Don't sign, create random string
            let invalidSignature = web3.utils.sha3(toSign);

            // Try to add self-claim as manager
            await shouldFail(identity.addClaim(Topic.PROFILE, Scheme.ECDSA, identity.address, invalidSignature, label, uri, {from: addr.manager[0]}));

            // Claim doesn't exist
            let claimId = await identity.getClaimId(identity.address, Topic.PROFILE);
            await shouldFail(identity.getClaim(claimId));
        });

        it("can add self-claim with manager approval", async () => {
            // Claim hash
            let uri = "https://twitter.com/mirceap";
            let label = web3.utils.utf8ToHex(uri);
            let toSign = await identity.claimToSign(identity.address, Topic.PROFILE, label);
            // Sign using CLAIM_SIGNER_KEY
            let signature = fixSignature(await web3.eth.sign(toSign, addr.claim[0]));

            // Add self-claim with claim key
            let r = await assertOkTx(identity.addClaim(Topic.PROFILE, Scheme.ECDSA, identity.address, signature, label, uri, {from: addr.claim[0]}));
            let claimRequestId = findClaimRequestId(r);

            // Claim doesn't exist yet
            let claimId = await identity.getClaimId(identity.address, Topic.PROFILE);
            await shouldFail(identity.getClaim(claimId));

            // Approve
            await assertOkTx(identity.approve(claimRequestId, true, {from: addr.manager[0]}));

            // Check claim
            await assertClaim(Topic.PROFILE, identity.address, signature, label, uri);

            await assertClaims(3, {[Topic.LABEL]: 2, [Topic.PROFILE]: 1});
        });

        it("other identity can add a claim", async () => {
            // Claim hash
            let uri = "https://twitter.com/mirceap";
            let label = web3.utils.utf8ToHex(uri);
            let toSign = await otherIdentity.claimToSign(identity.address, Topic.PROFILE, label);
            let signature = fixSignature(await web3.eth.sign(toSign, addr.other));

            // Deployer calls deployedContract.execute(...), which calls identity.addClaim(...)
            let executeData = identity.contract.methods.addClaim(Topic.PROFILE, Scheme.ECDSA, otherIdentity.address, signature, label, uri).encodeABI();
            let r = await assertOkTx(otherIdentity.execute(identity.address, 0, executeData, {from: addr.other}));
            let claimRequestId = findClaimRequestId(r);

            // Claim doesn't exist yet
            await assertClaims(2, {[Topic.LABEL]: 2});

            // Approve
            await assertOkTx(identity.approve(claimRequestId, true, {from: addr.manager[0]}));

            // Check claim
            await assertClaim(Topic.PROFILE, otherIdentity.address, signature, label, uri);
            await assertClaims(3, {[Topic.LABEL]: 2, [Topic.PROFILE]: 1});
        });
    });

    describe("changeClaim", () => {
        it("can update a self-claim", async () => {
            let label = web3.utils.utf8ToHex("Mircea Pasoi");
            let uri = "http://mirceapasoi.com";
            let newUri = "https://twitter.com/mirceap";

            // Claim hash
            let toSign = await identity.claimToSign(identity.address, Topic.LABEL, label);
            // Sign using CLAIM_SIGNER_KEY
            let signature = fixSignature(await web3.eth.sign(toSign, addr.claim[0]));
            // Check claim exists
            await assertClaim(Topic.LABEL, identity.address, signature, label, uri);

            // Use same signature to update URI
            await assertOkTx(identity.addClaim(Topic.LABEL, Scheme.ECDSA, identity.address, signature, label, newUri, {from: addr.manager[1]}));

            // Check claim was updated
            await assertClaim(Topic.LABEL, identity.address, signature, label, newUri);

            await assertClaims(2, {[Topic.LABEL]: 2});
        });

        it("checks signature when updating", async () => {
            let label = web3.utils.utf8ToHex("Mircea Pasoi");
            let uri = "http://mirceapasoi.com";
            let newUri = "https://twitter.com/mirceap";

            // Claim hash
            let toSign = await identity.claimToSign(identity.address, Topic.LABEL, label);
            // Don't sign, create random string
            let signature = fixSignature(await web3.eth.sign(toSign, addr.claim[0]));
            let invalidSignature = web3.utils.sha3(toSign);

            // Try to update self-claim as manager
            await shouldFail(identity.addClaim(Topic.LABEL, Scheme.ECDSA, identity.address, invalidSignature, label, newUri, {from: addr.manager[1]}));

            // Claim is unchanged
            await assertClaim(Topic.LABEL, identity.address, signature, label, uri);
        });

        it("needs approval to update a self-claim", async () => {
            let label = web3.utils.utf8ToHex("Mircea Pasoi");
            let uri = "http://mirceapasoi.com";
            let newUri = "https://twitter.com/mirceap";

            // Claim hash
            let toSign = await identity.claimToSign(identity.address, Topic.LABEL, label);
            // Sign using CLAIM_SIGNER_KEY
            let signature = fixSignature(await web3.eth.sign(toSign, addr.claim[0]));
            // Check claim
            await assertClaim(Topic.LABEL, identity.address, signature, label, uri);

            // Use same signature to update URI
            let r = await assertOkTx(identity.addClaim(Topic.LABEL, Scheme.ECDSA, identity.address, signature, label, newUri, {from: addr.claim[0]}));
            let claimRequestId = findClaimRequestId(r);

            // Check claim wasn't updated
            await assertClaim(Topic.LABEL, identity.address, signature, label, uri);

            // Approve
            await assertOkTx(identity.approve(claimRequestId, true, {from: addr.manager[1]}));

            // Check claim was updated
            await assertClaim(Topic.LABEL, identity.address, signature, label, newUri);

            await assertClaims(2, {[Topic.LABEL]: 2});
        });

        it("other identity can update a claim", async () => {
            let claimId = await identity.getClaimId(otherIdentity.address, Topic.LABEL);
            // Use same signature as before, but update uri
            const {topic, scheme, issuer, signature, data, uri} = await identity.getClaim(claimId);
            let newUri = "https://twitter.com/mirceap";

            // Deployer calls deployedContract.execute(...), which calls identity.addClaim(...)
            let executeData = identity.contract.methods.addClaim(Topic.LABEL, Scheme.ECDSA, otherIdentity.address, signature, data, newUri).encodeABI();
            let r = await assertOkTx(otherIdentity.execute(identity.address, 0, executeData, {from: addr.other}));
            let claimRequestId = findClaimRequestId(r);

            // Claim hasn't been updated yet
            await assertClaim(Topic.LABEL, otherIdentity.address, signature, data, uri);

            // Approve
            await assertOkTx(identity.approve(claimRequestId, true, {from: addr.manager[0]}));

            // Check claim
            await assertClaim(Topic.LABEL, otherIdentity.address, signature, data, newUri);
            await assertClaims(2, {[Topic.LABEL]: 2});
        });
    })

    describe("removeClaim", async () => {
        it("can remove a claim", async () => {
            // First claim
            let claimId = await identity.getClaimId(identity.address, Topic.LABEL);

            // Remove it
            await assertOkTx(identity.removeClaim(claimId, {from: addr.manager[0]}));

            // Check claim no longer exists
            await shouldFail(identity.getClaim(claimId));

            await assertClaims(1, {[Topic.LABEL]: 1});
        });

        it("other identity can remove a claim as a contract", async () => {
            await assertClaims(2, {[Topic.LABEL]: 2});
            let claimId = await identity.getClaimId(otherIdentity.address, Topic.LABEL);

            // Remove claim as contract
            let executeData = identity.contract.methods.removeClaim(claimId).encodeABI();
            await assertOkTx(otherIdentity.execute(identity.address, 0, executeData, {from: addr.other}));

            // Check claim no longer exists
            await shouldFail(identity.getClaim(claimId));

            await assertClaims(1, {[Topic.LABEL]: 1});
        })

        it("other identity can remove a claim", async () => {
            await assertClaims(2, {[Topic.LABEL]: 2});

            let claimId = await identity.getClaimId(otherIdentity.address, Topic.LABEL);

            // Remove claim using action key
            await assertOkTx(identity.removeClaim(claimId, {from: addr.other}));

            // Check claim no longer exists
            await shouldFail(identity.getClaim(claimId));

            await assertClaims(1, {[Topic.LABEL]: 1});
        });
    });

    describe("refreshClaim", () => {
        it ("keeps claims that are valid", async () => {
            let selfId = await identity.getClaimId(identity.address, Topic.LABEL);
            let otherId = await identity.getClaimId(otherIdentity.address, Topic.LABEL);

            // Refresh self claim with manager key
            await assertOkTx(identity.refreshClaim(selfId, {from: addr.manager[1]}));
            // Refresh other claim with action key
            await assertOkTx(identity.refreshClaim(otherId, {from: addr.other}));

            // Claims still there
            await assertClaims(2, {[Topic.LABEL]: 2});
        });

        it ("removes claims that are invalid", async () => {
            // Self removes claim key
            await assertOkTx(identity.removeKey(keys.claim[0], Purpose.CLAIM, {from: addr.manager[0]}));
            // Other identity removes claim key
            await assertOkTx(otherIdentity.removeKey(keys.other, Purpose.CLAIM, {from: addr.other}));

            let selfId = await identity.getClaimId(identity.address, Topic.LABEL);
            let otherId = await identity.getClaimId(otherIdentity.address, Topic.LABEL);

            // Refresh self-claim as contract
            let executeData = identity.contract.methods.refreshClaim(selfId).encodeABI();
            await assertOkTx(identity.execute(identity.address, 0, executeData, {from: addr.manager[1]}));
            // Refresh other claim as other contract
            executeData = identity.contract.methods.refreshClaim(otherId).encodeABI();
            await assertOkTx(otherIdentity.execute(identity.address, 0, executeData, {from: addr.other}));

            // Claims no longer there
            await assertClaims(0, {[Topic.LABEL]: 0});

        });
    });

    // TODO: test ClaimRequested, ClaimAdded, ClaimRemoved, ClaimChanged
});
