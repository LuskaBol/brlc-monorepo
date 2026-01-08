import "@cloudwalk/hardhat2-config";

export default {
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "london",
      optimizer: {
        runs: process.env.OPTIMIZER_RUNS ?? 200, // override to default 200
      },
    },
  },
};
