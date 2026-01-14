import "@cloudwalk/hardhat2-config";

export default {
  solidity: {
    version: "0.8.30",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        runs: Number(process.env.OPTIMIZER_RUNS ?? 200), // override to default 200
      },
      viaIR: true,
    },
  },
};
