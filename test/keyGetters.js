import assertRevert from 'zeppelin-solidity/test/helpers/assertRevert';
import { setupTest, Purpose, KeyType } from './base';
import { assertOkTx, printTestGas, printTotalGas } from './util';

contract("KeyGetters", async (accounts) => {
    let identity, addr, keys;

    afterEach("print gas", printTestGas);
    after("all done", printTotalGas);

    beforeEach("new contract", async () => {
        ({ identity, addr, keys } = await setupTest(accounts, [2, 2, 0, 0], [3, 3, 1, 1]));
    })

    let assertGetKey = async (key, purpose, keyType) => {
        let keyData = await identity.getKey(key, purpose);
        if (keyType) {
            keyData[0].should.be.bignumber.equal(purpose);
            keyData[1].should.be.bignumber.equal(keyType);
            assert.equal(keyData[2], key);
        } else {
            keyData[0].should.be.bignumber.equal(0);
            keyData[1].should.be.bignumber.equal(0);
            assert.equal(keyData[2], 0);
        }
    }

    // Getters
    describe("getKey", async () => {
        it("should return keys that exist", async () => {
            await assertGetKey(keys.manager[1], Purpose.MANAGEMENT, KeyType.ECDSA);
            await assertGetKey(keys.action[0], Purpose.ACTION, KeyType.ECDSA);
        });

        it("should not return keys that don't exist", async () => {
            await assertGetKey(keys.manager[0], Purpose.ACTION, 0);
            await assertGetKey(keys.action[1], Purpose.MANAGEMENT, 0);
        });
    });

    describe("getKeyPurpose", async () => {
        it("should return keys by purpose", async () => {
            let purposes = await identity.getKeyPurpose(keys.manager[0]);
            assert.equal(purposes.length, 1);
            purposes[0].should.be.bignumber.equal(Purpose.MANAGEMENT);
        });

        it("should return multiple keys by purpose", async () => {
            await assertOkTx(identity.addKey(keys.action[0], Purpose.MANAGEMENT, KeyType.ECDSA, {from: addr.manager[0]}));
            let purposes = await identity.getKeyPurpose(keys.action[0]);
            assert.equal(purposes.length, 2);
            purposes[0].should.be.bignumber.equal(Purpose.ACTION);
            purposes[1].should.be.bignumber.equal(Purpose.MANAGEMENT);
        });

        it("should not return keys without purpose", async () => {
            let purposes = await identity.getKeyPurpose(keys.claim[0]);
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

        it("should return all action keys", async () => {
            let k = await identity.getKeysByPurpose(Purpose.ACTION);
            assert.equal(k.length, 2);
            assert.equal(keys.action[0], k[0]);
            assert.equal(keys.action[1], k[1]);
        });

        it("should not return keys that haven't been added", async () => {
            let k = await identity.getKeysByPurpose(Purpose.CLAIM);
            assert.equal(k.length, 0);
        });
    });
});