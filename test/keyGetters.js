import { expect } from 'chai';
import { setupTest, Purpose, KeyType } from './base';
import { assertOkTx, printTestGas } from './util';

contract("KeyGetters", async (accounts) => {
    let identity, addr, keys;

    afterEach("print gas", printTestGas);

    beforeEach("new contract", async () => {
        ({ identity, addr, keys } = await setupTest(accounts, [2, 2, 0, 0], [3, 3, 1, 1]));
    })

    // Getters
    describe("keyHasPurpose", async () => {
        it("should return keys that exist", async () => {
            assert.isTrue(await identity.keyHasPurpose(keys.manager[1], Purpose.MANAGEMENT));
            assert.isTrue(await identity.keyHasPurpose(keys.execution[0], Purpose.EXECUTION));
        });

        it("should not return keys that don't exist", async () => {
            assert.isFalse(await identity.keyHasPurpose(keys.manager[0], Purpose.EXECUTION));
            assert.isFalse(await identity.keyHasPurpose(keys.execution[1], Purpose.MANAGEMENT));
        });
    });

    describe("getKey", async () => {
        it("should return key data", async () => {
            let {purposes, keyType, key} = await identity.getKey(keys.manager[0]);
            expect(keyType).to.be.bignumber.equal(KeyType.ECDSA.toString());
            assert.equal(key, keys.manager[0]);
            assert.equal(purposes.length, 1);
            expect(purposes[0]).to.be.bignumber.equal(Purpose.MANAGEMENT.toString());
        });

        it("should return multiple purposes", async () => {
            await assertOkTx(identity.addKey(keys.execution[0], Purpose.MANAGEMENT, KeyType.ECDSA, {from: addr.manager[0]}));
            let {purposes, keyType, key} = await identity.getKey(keys.execution[0]);
            expect(keyType).to.be.bignumber.equal(KeyType.ECDSA.toString());
            assert.equal(key, keys.execution[0]);
            assert.equal(purposes.length, 2);
            expect(purposes[0]).to.be.bignumber.equal(Purpose.EXECUTION.toString());
            expect(purposes[1]).to.be.bignumber.equal(Purpose.MANAGEMENT.toString());
        });

        it("should not return keys without purpose", async () => {
            let {purposes, keyType, key} = await identity.getKey(keys.claim[0]);
            expect(keyType).to.be.bignumber.equal('0');
            assert.equal(key, '0x' + '0'.repeat(64));
            assert.equal(purposes.length, 0);
        });
    });

    describe("getKeysByPurpose", async () => {
        it("should return all management keys", async () => {
            let k = await identity.getKeysByPurpose(Purpose.MANAGEMENT);
            assert.equal(k.length, 2);
            assert.equal(keys.manager[0], k[0]);
            assert.equal(keys.manager[1], k[1]);
        });

        it("should return all execution keys", async () => {
            let k = await identity.getKeysByPurpose(Purpose.EXECUTION);
            assert.equal(k.length, 2);
            assert.equal(keys.execution[0], k[0]);
            assert.equal(keys.execution[1], k[1]);
        });

        it("should not return keys that haven't been added", async () => {
            let k = await identity.getKeysByPurpose(Purpose.CLAIM);
            assert.equal(k.length, 0);
        });
    });
});