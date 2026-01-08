import { HardhatConfig } from "hardhat/types";

/**
 * Etherscan/block explorer verification configuration for CloudWalk networks.
 * Used by hardhat-verify plugin for contract verification.
 */
export const getEtherscan = (): HardhatConfig["etherscan"] => ({
  enabled: true,
  apiKey: {
    cw_testnet: "empty",
    cw_mainnet: "empty",
  },
  customChains: [
    {
      network: "cw_testnet",
      chainId: 2008,
      urls: {
        apiURL: "https://explorer-v8-api.services.staging.cloudwalk.network/api",
        browserURL: "https://explorer-v8.services.staging.cloudwalk.network",
      },
    },
    {
      network: "cw_mainnet",
      chainId: 2009,
      urls: {
        apiURL: "https://explorer-api-v8.services.production.cloudwalk.network/api",
        browserURL: "https://explorer-v8.services.production.cloudwalk.network",
      },
    },
  ],
});
