import { expectRevert } from 'openzeppelin-test-helpers';
import { setupTest, assertKeyCount, Purpose, KeyType } from './base';
import { printTestGas, assertOkTx } from './util';

const TestContract = artifacts.require("TestContract");

export const findExecutionId = (r) => {
    // You will not get that return value inside this result.
    // You must instead use an event and look up the result in the logs array.
    return r.logs.find(e => e.event == 'ExecutionRequested').args.executionId;
}

contract("MultiSig", async (accounts) => {
    let identity, otherContract, addr, keys;

    afterEach("print gas", printTestGas);

    beforeEach("new contract", async () => {
        ({ identity, addr, keys } = await setupTest(accounts, [3, 3, 0, 0], [4, 4, 1, 0]));
        otherContract = await TestContract.deployed();
    })

    describe("execute(_to = self)", async () => {
        it("should add key", async () => {
            await assertKeyCount(identity, Purpose.EXECUTION, 3);

            let addKeyData = identity.contract.methods.addKey(keys.execution[3], Purpose.EXECUTION, KeyType.ECDSA).encodeABI();
            await assertOkTx(identity.execute(identity.address, 0, addKeyData, {from: addr.manager[0]}));

            await assertKeyCount(identity, Purpose.EXECUTION, 4);
        });

        it("should add key only with management keys", async () => {
            await assertKeyCount(identity, Purpose.EXECUTION, 3);

            let addKeyData = identity.contract.methods.addKey(keys.execution[3], Purpose.EXECUTION, KeyType.ECDSA).encodeABI();
            await expectRevert(
                identity.execute(identity.address, 0, addKeyData, {from: addr.execution[0]}),
                'need management key for execute'
            );

            await assertKeyCount(identity, Purpose.EXECUTION, 3);
        });

        it("should remove key", async () => {
            await assertKeyCount(identity, Purpose.MANAGEMENT, 3);

            let removeKeyData = identity.contract.methods.removeKey(keys.manager[0], Purpose.MANAGEMENT).encodeABI();
            await assertOkTx(identity.execute(identity.address, 0, removeKeyData, {from: addr.manager[1]}));

            await assertKeyCount(identity, Purpose.MANAGEMENT, 2);
        });

        it("should remove key only with management keys", async () => {
            await assertKeyCount(identity, Purpose.MANAGEMENT, 3);

            let removeKeyData = identity.contract.methods.removeKey(keys.manager[0], Purpose.MANAGEMENT).encodeABI();
            await expectRevert(
                identity.execute(identity.address, 0, removeKeyData, {from: addr.execution[1]}),
                'need management key for execute'
            );

            await assertKeyCount(identity, Purpose.MANAGEMENT, 3);
        });
    });

    describe("execute(_to != self)", async () => {
        it("other contract works", async () => {
            assert.equal(await otherContract.numCalls(addr.execution[1]), 0);

            await assertOkTx(otherContract.callMe({from: addr.execution[1]}));

            assert.equal(await otherContract.numCalls(addr.execution[1]), 1);
        });

        it("should call other contracts with execution keys", async () => {
            // Identity never called other contract
            assert.equal(await otherContract.numCalls(identity.address), 0);

            let callData = otherContract.contract.methods.callMe().encodeABI();
            await assertOkTx(identity.execute(otherContract.address, 0, callData, {from: addr.execution[1]}));

            // Identity called other contract
            assert.equal(await otherContract.numCalls(identity.address), 1);
        });

        it("should not call other contracts with management keys", async () => {
            assert.equal(await otherContract.numCalls(identity.address), 0);

            let callData = otherContract.contract.methods.callMe().encodeABI();
            await expectRevert(
                identity.execute(otherContract.address, 0, callData, {from: addr.manager[1]}),
                'need execution key for execute'
            );

            assert.equal(await otherContract.numCalls(identity.address), 0);
        });
    });

    describe("multiple signatures", async () => {
        it("getKeysRequired", async () => {
            assert.equal(await identity.getKeysRequired(Purpose.MANAGEMENT), 1);
            assert.equal(await identity.getKeysRequired(Purpose.EXECUTION), 1);
        });

        it("can't overflow threshold", async () => {
            await expectRevert(
                identity.changeKeysRequired(Purpose.MANAGEMENT, 0, {from: addr.manager[0]}),
                'keys required too low'
            );
            await expectRevert(
                identity.changeKeysRequired(Purpose.MANAGEMENT, 10, {from: addr.manager[1]}),
                'keys required too high'
            );
            await expectRevert(
                identity.changeKeysRequired(Purpose.EXECUTION, 0, {from: addr.manager[0]}),
                'keys required too low'
            );
            await expectRevert(
                identity.changeKeysRequired(Purpose.EXECUTION, 15, {from: addr.manager[1]}),
                'keys required too high'
            );
        });

        it("can't call directly once threshold is set", async () => {
            // One manager increases the threshold
            await assertOkTx(identity.changeKeysRequired(Purpose.MANAGEMENT, 2, {from: addr.manager[0]}));
            assert.equal(await identity.getKeysRequired(Purpose.MANAGEMENT), 2);

            // Can't call methods directly
            await expectRevert(
                identity.addKey(keys.manager[3], Purpose.MANAGEMENT, KeyType.ECDSA, {from: addr.manager[0]}),
                'management threshold >1'
            );
            await expectRevert(
                identity.removeKey(keys.manager[2], Purpose.MANAGEMENT, {from: addr.manager[0]}),
                'management threshold >1'
            );
        });

        it("needs two managers to add a key", async () => {
            // One manager increases the threshold
            await assertOkTx(identity.changeKeysRequired(Purpose.MANAGEMENT, 2, {from: addr.manager[0]}));
            assert.equal(await identity.getKeysRequired(Purpose.MANAGEMENT), 2);

            // Only 3 managers
            await assertKeyCount(identity, Purpose.MANAGEMENT, 3);

            // Add a 4th manager
            let addKeyData = identity.contract.methods.addKey(keys.manager[3], Purpose.MANAGEMENT, KeyType.ECDSA).encodeABI();
            let r = await assertOkTx(identity.execute(identity.address, 0, addKeyData, {from: addr.manager[1]}));
            let id = findExecutionId(r);

            // Still 3
            await assertKeyCount(identity, Purpose.MANAGEMENT, 3);

            // Can't double approve
            await expectRevert(
                identity.approve(id, true, {from: addr.manager[1]}),
                'already approved'
            );

            // Execution keys can't approve
            await expectRevert(
                identity.approve(id, true, {from: addr.execution[0]}),
                'need management key for approve'
            );

            // Other manager disapproves at first
            await assertOkTx(identity.approve(id, false, {from: addr.manager[0]}));

            // Still 3
            await assertKeyCount(identity, Purpose.MANAGEMENT, 3);

            // But then approves!
            await assertOkTx(identity.approve(id, true, {from: addr.manager[0]}));

            // 4 managers
            await assertKeyCount(identity, Purpose.MANAGEMENT, 4);

            // ID no longer exists
            await expectRevert(
                identity.approve(id, false, {from: addr.manager[2]}),
                'null execution'
            );
        });

        it("needs three execution keys to call other", async () => {
            // One manager increases the threshold
            await assertOkTx(identity.changeKeysRequired(Purpose.EXECUTION, 3, {from: addr.manager[1]}));
            assert.equal(await identity.getKeysRequired(Purpose.EXECUTION), 3);

            // No calls yet
            assert.equal(await otherContract.numCalls(identity.address), 0);

            // One action requested
            let callData = otherContract.contract.methods.callMe().encodeABI();
            let r = await assertOkTx(identity.execute(otherContract.address, 0, callData, {from: addr.execution[1]}));
            let id = findExecutionId(r);

            // Still no calls
            assert.equal(await otherContract.numCalls(identity.address), 0);

            // Can't double approve
            await expectRevert(
                identity.approve(id, true, {from: addr.execution[1]}),
                'already approved'
            );

            // Management keys can't approve
            await expectRevert(
                identity.approve(id, true, {from: addr.manager[1]}),
                'need execution key for approve'
            );

            // Approve, disapprove, approve
            await assertOkTx(identity.approve(id, true, {from: addr.execution[0]}));
            await assertOkTx(identity.approve(id, false, {from: addr.execution[0]}));
            await assertOkTx(identity.approve(id, true, {from: addr.execution[0]}));
            assert.equal(await otherContract.numCalls(identity.address), 0);

            // One more approval
            await assertOkTx(identity.approve(id, true, {from: addr.execution[2]}));

            // Call has been made!
            assert.equal(await otherContract.numCalls(identity.address), 1);

            // ID no longer exists
            await expectRevert(
                identity.approve(id, false, {from: addr.execution[1]}),
                'null execution'
            );
        });
    });

    // TODO: test ExecutionRequested, Executed, Approved
});