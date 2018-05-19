import assertRevert from 'zeppelin-solidity/test/helpers/assertRevert';
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
            await assertKeyCount(identity, Purpose.ACTION, 2);

            await assertOkTx(identity.addKey(keys.action[2], Purpose.ACTION, KeyType.ECDSA, {from: addr.manager[0]}));
            await assertOkTx(identity.addKey(keys.action[2], Purpose.ACTION, KeyType.ECDSA, {from: addr.manager[1]}));

            // End with 3
            await assertKeyCount(identity, Purpose.ACTION, 3);

            let total = await identity.numKeys();
            total.should.be.bignumber.equal(5);
        });

        it ("should add only for management keys", async () => {
            // Start with 2
            await assertKeyCount(identity, Purpose.ACTION, 2);

            await assertRevert(identity.addKey(keys.action[2], Purpose.ACTION, KeyType.ECDSA, {from: addr.action[0]}));
            await assertRevert(identity.addKey(keys.action[2], Purpose.ACTION, KeyType.ECDSA, {from: addr.action[1]}));

            // End with 2
            await assertKeyCount(identity, Purpose.ACTION, 2);

            let total = await identity.numKeys();
            total.should.be.bignumber.equal(4);
        });

        it("should add multi-purpose keys", async () => {
            // Start with 2
            await assertKeyCount(identity, Purpose.MANAGEMENT, 2);
            await assertKeyCount(identity, Purpose.ACTION, 2);

            await assertOkTx(identity.addKey(keys.action[0], Purpose.MANAGEMENT, KeyType.ECDSA, {from: addr.manager[0]}));
            await assertOkTx(identity.addKey(keys.manager[0], Purpose.ACTION, KeyType.ECDSA, {from: addr.action[0]}));

            // End with 2
            await assertKeyCount(identity, Purpose.MANAGEMENT, 3);
            await assertKeyCount(identity, Purpose.ACTION, 3);

            let total = await identity.numKeys();
            total.should.be.bignumber.equal(6);
        });
    });

    describe("removeKey", async () => {
        it("should remove multi-purpose keys", async () => {
            // Start with 2
            await assertKeyCount(identity, Purpose.MANAGEMENT, 2);
            await assertKeyCount(identity, Purpose.ACTION, 2);

            // Add ACTION as MANAGEMENT
            await assertOkTx(identity.addKey(keys.action[0], Purpose.MANAGEMENT, KeyType.ECDSA, {from: addr.manager[0]}));
            await assertKeyCount(identity, Purpose.MANAGEMENT, 3);

            // Remove MANAGEMENT
            await assertOkTx(identity.removeKey(keys.manager[1], Purpose.MANAGEMENT, {from: addr.manager[0]}));
            await assertKeyCount(identity, Purpose.MANAGEMENT, 2);

            // Remove MANAGEMENT
            await assertOkTx(identity.removeKey(keys.manager[0], Purpose.MANAGEMENT, {from: addr.manager[0]}));
            await assertKeyCount(identity, Purpose.MANAGEMENT, 1);

            // Remove ACTION
            await assertOkTx(identity.removeKey(keys.action[0], Purpose.ACTION, {from: addr.action[0]}));
            await assertKeyCount(identity, Purpose.ACTION, 1);

            // Remove ACTION as MANAGEMENT
            await assertOkTx(identity.removeKey(keys.action[0], Purpose.MANAGEMENT, {from: addr.action[0]}));
            await assertKeyCount(identity, Purpose.MANAGEMENT, 0);

            // Storage is clean
            let [purposes, keyType, key] = await identity.getKey(keys.action[0]);
            keyType.should.be.bignumber.equal(0);
            key.should.be.bignumber.equal(0);
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
            total.should.be.bignumber.equal(2);
        });

        it("should remove only for management keys", async () => {
            // Start with 2
            await assertKeyCount(identity, Purpose.MANAGEMENT, 2);

            await assertRevert(identity.removeKey(keys.manager[0], Purpose.MANAGEMENT, {from: addr.action[0]}));
            await assertRevert(identity.removeKey(keys.manager[1], Purpose.MANAGEMENT, {from: addr.action[1]}));

            // End with 2
            await assertKeyCount(identity, Purpose.MANAGEMENT, 2);

            let total = await identity.numKeys();
            total.should.be.bignumber.equal(4);
        });

        it ("should ignore keys that don't exist", async () => {
            await assertKeyCount(identity, Purpose.CLAIM, 0);
            await assertKeyCount(identity, Purpose.ENCRYPT, 0);

            await assertOkTx(identity.removeKey(keys.claim[0], Purpose.CLAIM, {from: addr.manager[0]}));
            await assertOkTx(identity.removeKey(keys.encrypt[0], Purpose.ENCRYPT, {from: addr.manager[0]}));

            let total = await identity.numKeys();
            total.should.be.bignumber.equal(4);
        });
    });

    // TODO: test KeyAdded, KeyRemoved
});