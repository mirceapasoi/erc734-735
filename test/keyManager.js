import { shouldFail } from 'openzeppelin-test-helpers';
import { expect } from 'chai';
import { setupTest, assertKeyCount, Purpose, KeyType } from './base';
import { printTestGas, assertOkTx } from './util';

contract("KeyManager", async (accounts) => {
    let identity, addr, keys;

    afterEach("print gas", printTestGas);

    beforeEach("new contract", async () => {
        ({ identity, addr, keys } = await setupTest(accounts, [2, 2, 0, 0], [3, 3, 1, 1]));
    })

    describe("addKey", async () => {
        it("should not add the same key twice", async () => {
            // Start with 2
            await assertKeyCount(identity, Purpose.EXECUTION, 2);

            await assertOkTx(identity.addKey(keys.execution[2], Purpose.EXECUTION, KeyType.ECDSA, {from: addr.manager[0]}));
            await assertOkTx(identity.addKey(keys.execution[2], Purpose.EXECUTION, KeyType.ECDSA, {from: addr.manager[1]}));

            // End with 3
            await assertKeyCount(identity, Purpose.EXECUTION, 3);

            let total = await identity.numKeys();
            expect(total).to.be.bignumber.equal('5');
        });

        it ("should add only for management keys", async () => {
            // Start with 2
            await assertKeyCount(identity, Purpose.EXECUTION, 2);

            await shouldFail(identity.addKey(keys.execution[2], Purpose.EXECUTION, KeyType.ECDSA, {from: addr.execution[0]}));
            await shouldFail(identity.addKey(keys.execution[2], Purpose.EXECUTION, KeyType.ECDSA, {from: addr.execution[1]}));

            // End with 2
            await assertKeyCount(identity, Purpose.EXECUTION, 2);

            let total = await identity.numKeys();
            expect(total).to.be.bignumber.equal('4');
        });

        it("should add multi-purpose keys", async () => {
            // Start with 2
            await assertKeyCount(identity, Purpose.MANAGEMENT, 2);
            await assertKeyCount(identity, Purpose.EXECUTION, 2);

            await assertOkTx(identity.addKey(keys.execution[0], Purpose.MANAGEMENT, KeyType.ECDSA, {from: addr.manager[0]}));
            await assertOkTx(identity.addKey(keys.manager[0], Purpose.EXECUTION, KeyType.ECDSA, {from: addr.execution[0]}));

            // End with 2
            await assertKeyCount(identity, Purpose.MANAGEMENT, 3);
            await assertKeyCount(identity, Purpose.EXECUTION, 3);

            let total = await identity.numKeys();
            expect(total).to.be.bignumber.equal('6');
        });
    });

    describe("removeKey", async () => {
        it("should remove multi-purpose keys", async () => {
            // Start with 2
            await assertKeyCount(identity, Purpose.MANAGEMENT, 2);
            await assertKeyCount(identity, Purpose.EXECUTION, 2);

            // Add EXECUTION as MANAGEMENT
            await assertOkTx(identity.addKey(keys.execution[0], Purpose.MANAGEMENT, KeyType.ECDSA, {from: addr.manager[0]}));
            await assertKeyCount(identity, Purpose.MANAGEMENT, 3);

            // Remove MANAGEMENT
            await assertOkTx(identity.removeKey(keys.manager[1], Purpose.MANAGEMENT, {from: addr.manager[0]}));
            await assertKeyCount(identity, Purpose.MANAGEMENT, 2);

            // Remove MANAGEMENT
            await assertOkTx(identity.removeKey(keys.manager[0], Purpose.MANAGEMENT, {from: addr.manager[0]}));
            await assertKeyCount(identity, Purpose.MANAGEMENT, 1);

            // Remove EXECUTION
            await assertOkTx(identity.removeKey(keys.execution[0], Purpose.EXECUTION, {from: addr.action[0]}));
            await assertKeyCount(identity, Purpose.EXECUTION, 1);

            // Remove EXECUTION as MANAGEMENT
            await assertOkTx(identity.removeKey(keys.execution[0], Purpose.MANAGEMENT, {from: addr.action[0]}));
            await assertKeyCount(identity, Purpose.MANAGEMENT, 0);

            // Storage is clean
            let {purposes, keyType, key} = await identity.getKey(keys.execution[0]);
            expect(keyType).to.be.bignumber.equal('0');
            assert.equal(key, '0x' + '0'.repeat(64));
            assert.equal(purposes.length, 0);
        });

        it("should remove existing key", async () => {
            // Start with 2
            await assertKeyCount(identity, Purpose.MANAGEMENT, 2);

            // Remove 1
            await assertOkTx(identity.removeKey(keys.manager[1], Purpose.MANAGEMENT, {from: addr.manager[0]}));
            await assertKeyCount(identity, Purpose.MANAGEMENT, 1);

            // Remove self
            await assertOkTx(identity.removeKey(keys.manager[0], Purpose.MANAGEMENT, {from: addr.manager[0]}));
            await assertKeyCount(identity, Purpose.MANAGEMENT, 0);

            let total = await identity.numKeys();
            expect(total).to.be.bignumber.equal('2');
        });

        it("should remove only for management keys", async () => {
            // Start with 2
            await assertKeyCount(identity, Purpose.MANAGEMENT, 2);

            await shouldFail(identity.removeKey(keys.manager[0], Purpose.MANAGEMENT, {from: addr.action[0]}));
            await shouldFail(identity.removeKey(keys.manager[1], Purpose.MANAGEMENT, {from: addr.action[1]}));

            // End with 2
            await assertKeyCount(identity, Purpose.MANAGEMENT, 2);

            let total = await identity.numKeys();
            expect(total).to.be.bignumber.equal('4');
        });

        it ("should ignore keys that don't exist", async () => {
            await assertKeyCount(identity, Purpose.CLAIM, 0);
            await assertKeyCount(identity, Purpose.ENCRYPT, 0);

            await assertOkTx(identity.removeKey(keys.claim[0], Purpose.CLAIM, {from: addr.manager[0]}));
            await assertOkTx(identity.removeKey(keys.encrypt[0], Purpose.ENCRYPT, {from: addr.manager[0]}));

            let total = await identity.numKeys();
            expect(total).to.be.bignumber.equal('4');
        });
    });

    // TODO: test KeyAdded, KeyRemoved
});