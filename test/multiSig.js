import assertRevert from 'zeppelin-solidity/test/helpers/assertRevert';
import { setupTest, assertKeyCount, Purpose, KeyType } from './base';
import { printTestGas, assertOkTx } from './util';


const TestContract = artifacts.require("TestContract");

contract("MultiSig", async (accounts) => {
    let identity, otherContract, addr, keys;

    afterEach("print gas", printTestGas);

    beforeEach("new contract", async () => {
        ({ identity, addr, keys } = await setupTest(accounts, [3, 3, 0, 0], [4, 4, 1, 0]));
        otherContract = await TestContract.deployed();
    })

    const findExecutionId = (r) => {
        // You will not get that return value inside this result.
        // You must instead use an event and look up the result in the logs array.
        return r.logs.find(e => e.event == 'ExecutionRequested').args.executionId;
    }

    describe("execute(_to = self)", async () => {
        it("should add key", async () => {
            await assertKeyCount(identity, Purpose.ACTION, 3);

            let addKeyData = await identity.contract.addKey.getData(keys.action[3], Purpose.ACTION, KeyType.ECDSA);
            await assertOkTx(identity.execute(identity.address, 0, addKeyData, {from: addr.manager[0]}));

            await assertKeyCount(identity, Purpose.ACTION, 4);
        });

        it("should add key only with management keys", async () => {
            await assertKeyCount(identity, Purpose.ACTION, 3);

            let addKeyData = await identity.contract.addKey.getData(keys.action[3], Purpose.ACTION, KeyType.ECDSA);
            await assertRevert(identity.execute(identity.address, 0, addKeyData, {from: addr.action[0]}));

            await assertKeyCount(identity, Purpose.ACTION, 3);
        });

        it("should remove key", async () => {
            await assertKeyCount(identity, Purpose.MANAGEMENT, 3);

            let removeKeyData = await identity.contract.removeKey.getData(keys.manager[0], Purpose.MANAGEMENT);
            await assertOkTx(identity.execute(identity.address, 0, removeKeyData, {from: addr.manager[1]}));

            await assertKeyCount(identity, Purpose.MANAGEMENT, 2);
        });

        it("should remove key only with management keys", async () => {
            await assertKeyCount(identity, Purpose.MANAGEMENT, 3);

            let removeKeyData = await identity.contract.removeKey.getData(keys.manager[0], Purpose.MANAGEMENT);
            await assertRevert(identity.execute(identity.address, 0, removeKeyData, {from: addr.action[1]}));

            await assertKeyCount(identity, Purpose.MANAGEMENT, 3);
        });
    });

    describe("execute(_to != self)", async () => {
        it("other contract works", async () => {
            assert.equal(await otherContract.numCalls(addr.action[1]), 0);

            await assertOkTx(otherContract.callMe({from: addr.action[1]}));

            assert.equal(await otherContract.numCalls(addr.action[1]), 1);
        });

        it("should call other contracts with action keys", async () => {
            // Identity never called other contract
            assert.equal(await otherContract.numCalls(identity.address), 0);

            let callData = await otherContract.contract.callMe.getData();
            await assertOkTx(identity.execute(otherContract.address, 0, callData, {from: addr.action[1]}));

            // Identity called other contract
            assert.equal(await otherContract.numCalls(identity.address), 1);
        });

        it("should not call other contracts with management keys", async () => {
            assert.equal(await otherContract.numCalls(identity.address), 0);

            let callData = await otherContract.contract.callMe.getData();
            await assertRevert(identity.execute(otherContract.address, 0, callData, {from: addr.manager[1]}));

            assert.equal(await otherContract.numCalls(identity.address), 0);
        });
    });

    describe("multiple signatures", async () => {
        it("can't overflow threshold", async () => {
            await assertRevert(identity.changeManagementThreshold(0, {from: addr.manager[0]}));
            await assertRevert(identity.changeManagementThreshold(10, {from: addr.manager[1]}));
            await assertRevert(identity.changeActionThreshold(0, {from: addr.manager[0]}));
            await assertRevert(identity.changeActionThreshold(15, {from: addr.manager[1]}));
        });

        it("can't call directly once threshold is set", async () => {
            // One manager increases the threshold
            await assertOkTx(identity.changeManagementThreshold(2, {from: addr.manager[0]}));

            // Can't call methods directly
            await assertRevert(identity.addKey(keys.manager[3], Purpose.MANAGEMENT, KeyType.ECDSA, {from: addr.manager[0]}));
            await assertRevert(identity.removeKey(keys.manager[2], Purpose.MANAGEMENT, {from: addr.manager[0]}));
        });

        it("needs two managers to add a key", async () => {
            // One manager increases the threshold
            await assertOkTx(identity.changeManagementThreshold(2, {from: addr.manager[0]}));

            // Only 3 managers
            await assertKeyCount(identity, Purpose.MANAGEMENT, 3);

            // Add a 4th manager
            let addKeyData = await identity.contract.addKey.getData(keys.manager[3], Purpose.MANAGEMENT, KeyType.ECDSA);
            let r = await assertOkTx(identity.execute(identity.address, 0, addKeyData, {from: addr.manager[1]}));
            let id = findExecutionId(r);

            // Still 3
            await assertKeyCount(identity, Purpose.MANAGEMENT, 3);

            // Can't double approve
            await assertRevert(identity.approve(id, true, {from: addr.manager[1]}));

            // Action keys can't approve
            await assertRevert(identity.approve(id, true, {from: addr.action[0]}));

            // Other manager disapproves at first
            await assertOkTx(identity.approve(id, false, {from: addr.manager[0]}));

            // Still 3
            await assertKeyCount(identity, Purpose.MANAGEMENT, 3);

            // But then approves!
            await assertOkTx(identity.approve(id, true, {from: addr.manager[0]}));

            // 4 managers
            await assertKeyCount(identity, Purpose.MANAGEMENT, 4);

            // ID no longer exists
            await assertRevert(identity.approve(id, false, {from: addr.manager[2]}));
        });

        it("needs three action keys to call other", async () => {
            // One manager increases the threshold
            await assertOkTx(identity.changeActionThreshold(3, {from: addr.manager[1]}));

            // No calls yet
            assert.equal(await otherContract.numCalls(identity.address), 0);

            // One action requested
            let callData = await otherContract.contract.callMe.getData();
            let r = await assertOkTx(identity.execute(otherContract.address, 0, callData, {from: addr.action[1]}));
            let id = findExecutionId(r);

            // Still no calls
            assert.equal(await otherContract.numCalls(identity.address), 0);

            // Can't double approve
            await assertRevert(identity.approve(id, true, {from: addr.action[1]}));

            // Management keys can't approve
            await assertRevert(identity.approve(id, true, {from: addr.manager[1]}));

            // Approve, disapprove, approve
            await assertOkTx(identity.approve(id, true, {from: addr.action[0]}));
            await assertOkTx(identity.approve(id, false, {from: addr.action[0]}));
            await assertOkTx(identity.approve(id, true, {from: addr.action[0]}));
            assert.equal(await otherContract.numCalls(identity.address), 0);

            // One more approval
            await assertOkTx(identity.approve(id, true, {from: addr.action[2]}));

            // Call has been made!
            assert.equal(await otherContract.numCalls(identity.address), 1);

            // ID no longer exists
            await assertRevert(identity.approve(id, false, {from: addr.action[1]}));
        });
    });

    // TODO: test ExecutionRequested, Executed, Approved
});