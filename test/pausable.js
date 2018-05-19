import assertRevert from 'zeppelin-solidity/test/helpers/assertRevert';
import { setupTest, Purpose, KeyType } from './base';
import { assertOkTx, printTestGas } from './util';

contract("Pausable", async (accounts) => {
    let identity, addr, keys;

    afterEach("print gas", printTestGas);

    beforeEach("new contract", async () => {
        ({ identity, addr, keys } = await setupTest(accounts,  [2, 2, 0, 0], [3, 3, 0, 0]));
    })

    it("should be paused/unpaused by management keys", async () => {
        await assertOkTx(identity.pause({from: addr.manager[0]}));
        // Can't add key
        await assertRevert(identity.addKey(keys.action[2], Purpose.ACTION, KeyType.ECDSA, {from: addr.manager[0]}));
        await assertOkTx(identity.unpause({from: addr.manager[1]}));
    });

    it("should not be paused by others", async () => {
        await assertRevert(identity.pause({from: addr.action[0]}));
    });
});