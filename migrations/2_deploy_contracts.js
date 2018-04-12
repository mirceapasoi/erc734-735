const Identity = artifacts.require("./Identity.sol");
const TestContract = artifacts.require("./TestContract.sol");

module.exports = function(deployer, network, accounts) {
  deployer.deploy(Identity, [], [], [], 1, 1);
  deployer.deploy(TestContract);
};