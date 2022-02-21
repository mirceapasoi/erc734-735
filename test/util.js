// Track gas
let gasUsed = 0;
let totalGas = 0;

const RLP = require("rlp");

export const contractAddress = async (deployedBy) => {
    // https://ethereum.stackexchange.com/questions/2527/is-there-a-way-to-find-an-accounts-current-transaction-nonce
    let nonce = await web3.eth.getTransactionCount(deployedBy);
    // https://stackoverflow.com/questions/18879880/how-to-display-nodejs-raw-buffer-data-as-hex-string
    let rlp = RLP.utils.bytesToHex(RLP.encode([deployedBy, nonce]));
    // https://ethereum.stackexchange.com/questions/760/how-is-the-address-of-an-ethereum-contract-computed
    let hash = web3.utils.soliditySha3({ t: "bytes", v: rlp });
    let address = web3.utils.toChecksumAddress("0x" + hash.slice(26));
    return address;
};

export const fixSignature = (signature) => {
    // from https://github.com/OpenZeppelin/openzeppelin-solidity/blob/79dd498b16b957399f84b9aa7e720f98f9eb83e3/test/helpers/sign.js#L12
    // in geth its always 27/28, in ganache its 0/1. Change to 27/28 to prevent
    // signature malleability if version is 0/1
    // see https://github.com/ethereum/go-ethereum/blob/v1.8.23/internal/ethapi/api.go#L465
    let v = parseInt(signature.slice(130, 132), 16);
    if (v < 27) {
        v += 27;
    }
    const vHex = v.toString(16);
    return signature.slice(0, 130) + vHex;
};

export const getAndClearGas = () => {
    let t = gasUsed;
    gasUsed = 0;
    return t;
};

export const printTestGas = () => {
    totalGas += gasUsed;
    console.log(`\tTest only: ${getAndClearGas().toLocaleString()} gas`.grey);
};

// Measure gas
export const measureTx = async (txHash) => {
    let receipt = await web3.eth.getTransactionReceipt(txHash);
    gasUsed += receipt.gasUsed;
};

export const assertOkTx = async (promise) => {
    let r = await promise;
    gasUsed += r.receipt.gasUsed;
    assert.isOk(r);
    return r;
};

export const assertBlockGasLimit = async (atLeast) => {
    let block = await web3.eth.getBlock("latest");
    let limit = block.gasLimit;
    assert.isAtLeast(limit, atLeast);
};
