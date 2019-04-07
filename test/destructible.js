import { shouldFail } from 'openzeppelin-test-helpers';
import { setupTest } from './base';
import { assertOkTx, printTestGas } from './util';

contract("Destructible", async (accounts) => {
    let identity, addr, keys;

    afterEach("print gas", printTestGas);

    beforeEach("new contract", async () => {
        ({ identity, addr, keys } = await setupTest(accounts, [2, 2, 0, 0], [3, 3, 0, 0]));
    })

    it("should be killed by management keys", async () => {
        assert.notEqual(await web3.eth.getCode(identity.address), "0x");
        await assertOkTx(identity.destroyAndSend(addr.manager[0], {from: addr.manager[1]}));
        assert.strictEqual(await web3.eth.getCode(identity.address), "0x");
    });

    it("should not be killed by others", async () => {
        await shouldFail(identity.destroyAndSend(addr.execution[0], {from: addr.execution[0]}));
    });
});