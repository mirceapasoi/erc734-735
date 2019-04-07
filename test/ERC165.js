import { shouldFail } from 'openzeppelin-test-helpers';
import { setupTest } from './base';
import { printTestGas } from './util';

const TestContract = artifacts.require("TestContract");

contract("ERC165", async (accounts) => {
    let identity, addr, keys;
    const input = {
        "0xffffffff": false,
        "0x01ffc9a7": true, // ERC165
        "0xdc3d2a7b": true, // ERC725
        "0x10765379": true, // ERC735
        "0xcc4b7902": true, // ERC725 + ERC735
    };

    afterEach("print gas", printTestGas);

    beforeEach("new contract", async () => {
        ({ identity, addr, keys } = await setupTest(accounts, [2, 2, 0, 0], [3, 3, 0, 0]));
    })

    it("noThrowCall doesn't throw", async () => {
        let test = await TestContract.deployed();
        let success, result;
        // Call reverts
        await shouldFail(test.supportsInterface("0xffffffff"));
        // Staticcall doesn't
        ({ success, result } = await test.noThrowCall(test.address, "0xffffffff"));
        assert.isFalse(success);
    })

    it("noThrowCall works", async () => {
        let test = await TestContract.deployed();
        let success, result;
        for (let i of Object.keys(input)) {
            ({ success, result } = await test.noThrowCall(identity.address, i));
            assert.isTrue(success);
            assert.equal(input[i], result);
        }
    });

    it("ERC165Query works", async() => {
        let test = await TestContract.deployed();
        for (let i of Object.keys(input)) {
            let result = await test.doesContractImplementInterface(identity.address, i);
            assert.equal(input[i], result);
        }
    });

    it("Identity supports ERC165, ERC725, ERC735", async () => {
        for (let i of Object.keys(input)) {
            let result = await identity.supportsInterface(i);
            assert.equal(input[i], result);
        }
    });
});