import { NetworksUserConfig } from "hardhat/types";
import { mnemonicOrDefault, pkOrEmpty } from "./helpers";

/**
 * Network configurations for CloudWalk smart contract development.
 * Includes local development networks and CloudWalk blockchain networks.
 */
export const getDefaultNetworks = (env: NodeJS.ProcessEnv): NetworksUserConfig => ({
  hardhat: {
    accounts: mnemonicOrDefault(env.HARDHAT_MNEMONIC),
    hardfork: "cancun",
  },
  stratus: {
    url: `http://localhost:${env.STRATUS_PORT || 3000}`,
    accounts: mnemonicOrDefault(env.STRATUS_MNEMONIC),
    timeout: 40000,
  },
  cw_testnet: {
    url: env.CW_TESTNET_RPC ?? "",
    accounts: pkOrEmpty(env.CW_TESTNET_PK) ?? mnemonicOrDefault(env.CW_TESTNET_MNEMONIC),
  },
  cw_mainnet: {
    url: env.CW_MAINNET_RPC ?? "",
    accounts: pkOrEmpty(env.CW_MAINNET_PK) ?? mnemonicOrDefault(env.CW_MAINNET_MNEMONIC),
  },
});
