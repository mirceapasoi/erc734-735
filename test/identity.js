import assertRevert from 'zeppelin-solidity/test/helpers/assertRevert';
import { setupTest, Purpose, KeyType, Topic } from './base';
import { assertOkTx, printTestGas } from './util';

const TestContract = artifacts.require("TestContract");

contract("Identity", async (accounts) => {
    let identity, addr, keys;

    const oneUnit = web3.toWei(100, "finney");

    afterEach("print gas", printTestGas);

    beforeEach("new contract", async () => {
        ({ identity, addr, keys } = await setupTest(
            accounts,
            [2, 2, 1, 0],
            [3, 3, 1, 0],
            [{type: Topic.LABEL, data: 'Mircea Pasoi', uri: '', self: true}]
        ));
    })

    it("should receive ether", async () => {
        // Start with 0
        let balance = web3.eth.getBalance(identity.address);
        balance.should.be.bignumber.equal(0);
        // Receive
        await assertOkTx(identity.sendTransaction({from: addr.other, value: oneUnit}));
        // Has ether
        balance = web3.eth.getBalance(identity.address);
        balance.should.be.bignumber.equal(oneUnit);
    });

    it("should send ether", async () => {
        // Receive
        await assertOkTx(identity.sendTransaction({from: addr.other, value: oneUnit}));
        let currentBalance = web3.eth.getBalance(addr.other);
        // Send back using ACTION key
        await assertOkTx(identity.execute(addr.other, oneUnit, '', {from: addr.action[0]}));
        // 0 again
        let balance = web3.eth.getBalance(identity.address);
        balance.should.be.bignumber.equal(0);
        // Address got money back
        balance = web3.eth.getBalance(addr.other);
        balance.should.be.bignumber.greaterThan(currentBalance);
    });

    it("can validate claims off-chain", async () => {
        // You claim to be identity.address, I give you a random string to sign
        let challenge = web3.sha3("random-string");
        // You give me back the signature
        let signature = web3.eth.sign(addr.action[0], challenge);
        // I recover address from signature
        // Using contract helper function here, but any implementation of ECRecover will do
        let signedBy = await identity.getSignatureAddress(challenge, signature);
        let signedByKey = await identity.addrToKey(signedBy);
        // Check if this is an action key in the identity you claim
        assert.isTrue(await identity.keyHasPurpose(signedByKey, Purpose.ACTION));
        // I now believe you are identity.address so I'll search for a label
        let labels = await identity.getClaimIdsByType(Topic.LABEL);
        assert.isAbove(labels.length, 0);
        // Get first label
        const [, , , , label, ] = await identity.getClaim(labels[0]);
    });

    it("can validate claims on-chain", async () => {
        let label = "Mircea Pasoi";
        let test = await TestContract.deployed();
        // Identity contract calls TestContract.whoCalling
        let data = test.contract.whoCalling.getData();
        await assertOkTx(identity.execute(test.address, 0, data, {from: addr.action[0]}));
        // Check TestContract events
        let event = test.contract.IdentityCalled();
        event.watch((e, r) => {
            // Convert bytes to string and trim
            let data = web3.toAscii(r[0].args.data).slice(0, label.length);
            assert.equal(data, label);
        });
        event.stopWatching();
    });
});