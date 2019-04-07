import { BN, expectEvent } from 'openzeppelin-test-helpers';
import { expect } from 'chai';
import { setupTest, Purpose, KeyType, Topic } from './base';
import { assertOkTx, printTestGas, fixSignature } from './util';

const TestContract = artifacts.require("TestContract");

contract("Identity", async (accounts) => {
    let identity, addr, keys;

    const oneUnit = web3.utils.toWei("100", "finney");

    afterEach("print gas", printTestGas);

    beforeEach("new contract", async () => {
        ({ identity, addr, keys } = await setupTest(
            accounts,
            [2, 2, 1, 0],
            [3, 3, 1, 0],
            [{type: Topic.LABEL, data: 'Mircea Pasoi', uri: '', self: true}]
        ));
    });

    it("should receive ether", async () => {
        // Start with 0
        let balance = await web3.eth.getBalance(identity.address);
        assert.equal(balance, '0');
        // Receive
        await assertOkTx(identity.sendTransaction({from: addr.other, value: oneUnit}));
        // Has ether
        balance = await web3.eth.getBalance(identity.address);
        assert.equal(balance, oneUnit);
    });

    it("should send ether", async () => {
        // Receive
        await assertOkTx(identity.sendTransaction({from: addr.other, value: oneUnit}));
        let currentBalance = await web3.eth.getBalance(addr.other);
        // Send back using EXECUTION key
        await assertOkTx(identity.execute(addr.other, oneUnit, [], {from: addr.execution[0]}));
        // 0 again
        let balance = await web3.eth.getBalance(identity.address);
        assert.equal(balance, '0');
        // Address got money back
        balance = await web3.eth.getBalance(addr.other);
        expect(new BN(balance)).to.be.bignumber.greaterThan(currentBalance);
    });

    it("can validate claims off-chain", async () => {
        // You claim to be identity.address, I give you a random string to sign
        let challenge = web3.utils.sha3("random-string");
        // You give me back the signature
        let signature = fixSignature(await web3.eth.sign(challenge, addr.execution[0]));
        // I recover address from signature
        // Using contract helper function here, but any implementation of ECRecover will do
        let signedBy = await identity.getSignatureAddress(challenge, signature);
        let signedByKey = await identity.addrToKey(signedBy);
        // Check if this is an execution key in the identity you claim
        assert.isTrue(await identity.keyHasPurpose(signedByKey, Purpose.EXECUTION));
        // I now believe you are identity.address so I'll search for a label
        let labels = await identity.getClaimIdsByType(Topic.LABEL);
        assert.isAbove(labels.length, 0);
        // Get first label
        const { label } = await identity.getClaim(labels[0]);
    });

    it("can validate claims on-chain", async () => {
        let label = web3.utils.utf8ToHex("Mircea Pasoi");
        let test = await TestContract.deployed();
        // Identity contract calls TestContract.whoCalling
        let executeData = test.contract.methods.whoCalling().encodeABI();
        const { tx } = await assertOkTx(
            identity.execute(test.address, 0, executeData, {from: addr.execution[0]})
        );
        // Check TestContract events
        await expectEvent.inTransaction(tx, TestContract, 'IdentityCalled', {
            data: label
        });
    });
});