// Big numbers
const BigNumber = web3.BigNumber;
require('chai').use(require('chai-bignumber')(BigNumber)).should();

// Track gas
let gasUsed = 0;
let totalGas = 0;

const RLP = require('rlp');

export const contractAddress = (deployedBy) => {
    // https://ethereum.stackexchange.com/questions/2527/is-there-a-way-to-find-an-accounts-current-transaction-nonce
    let nonce = web3.eth.getTransactionCount(deployedBy);
    // https://stackoverflow.com/questions/18879880/how-to-display-nodejs-raw-buffer-data-as-hex-string
    let rlp = RLP.encode([deployedBy, nonce]).toString('hex');
    // https://ethereum.stackexchange.com/questions/760/how-is-the-address-of-an-ethereum-contract-computed
    let hash = web3.sha3(rlp, {encoding: 'hex'});
    let address = "0x" + hash.slice(26);
    return address;
}

export const getAndClearGas = () => {
    let t = gasUsed;
    gasUsed = 0;
    return t;
}

export const printTestGas = () => {
    totalGas += gasUsed;
    console.log(`\tTest only: ${getAndClearGas().toLocaleString()} gas`.grey);
}

// Measure gas
export const measureTx = async (txHash) => {
    let receipt = await web3.eth.getTransactionReceipt(txHash);
    gasUsed += receipt.gasUsed;
}

export const assertOkTx = async promise => {
    let r = await promise;
    gasUsed += r.receipt.gasUsed;
    assert.isOk(r);
    return r;
}

export const assertBlockGasLimit = (atLeast) => {
    let block = web3.eth.getBlock("latest");
    let limit = block.gasLimit;
    assert.isAtLeast(limit, atLeast);
}