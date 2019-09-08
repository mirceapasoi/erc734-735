// <https://ethereum.stackexchange.com/questions/21210/syntaxerror-unexpected-token-import-on-truffle-test/21211#21211>
require('babel-register')({
  only: ['test/']
});
require('babel-polyfill');

module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*" // Match any network id
    }
  },
  mocha: {
    reporter: 'eth-gas-reporter',
    reporterOptions : {
      currency: 'USD',
      onlyCalledMethods: true
    }
  },
  compilers: {
    solc: {
      version: "0.5.11"
    }
  }
};
