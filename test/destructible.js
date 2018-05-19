import assertRevert from 'zeppelin-solidity/test/helpers/assertRevert';
import { setupTest, Purpose, KeyType } from './base';
import { assertOkTx, printTestGas } from './util';

contract("Destructible", async (accounts) => {
    let identity, addr, keys;

    afterEach("print gas", printTestGas);

    beforeEach("new contract", async () => {
        ({ identity, addr, keys } = await setupTest(accounts, [2, 2, 0, 0], [3, 3, 0, 0]));
    })

    it("should be killed by management keys", async () => {
        assert.notEqual(web3.eth.getCode(identity.address), "0x0");
        await assertOkTx(identity.destroyAndSend(addr.manager[0], {from: addr.manager[1]}));
        assert.strictEqual(web3.eth.getCode(identity.address), "0x0");
    });

    it("should not be killed by others", async () => {
        await assertRevert(identity.destroyAndSend(addr.action[0], {from: addr.action[0]}));
    });
});