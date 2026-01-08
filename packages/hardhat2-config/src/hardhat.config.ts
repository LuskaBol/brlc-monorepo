// common plugins
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-contract-sizer";

// dependencies
import { mochaHooks } from "@cloudwalk/chainshot";
import chalk from "chalk";
import type { HardhatUserConfig } from "hardhat/config";
import type { SolcUserConfig } from "hardhat/types";
import merge from "lodash/merge";
import dotenv from "dotenv";
import { extendConfig } from "hardhat/config";
import { getDefaultNetworks } from "./networks";
import { getEtherscan } from "./etherscan";

dotenv.config();

function warnDefault(label: string, value: string) {
  console.warn(
    chalk.yellow.bold("⚠️  Notice:") +
    chalk.reset(` Default Solidity ${label} is `) +
    chalk.cyan(value) +
    chalk.reset(". Consider updating your project to use it."),
  );
}

function validateUserConfig(userConfig: Partial<HardhatUserConfig>):
  userConfig is { solidity: SolcUserConfig } {
  if (!userConfig.solidity || Array.isArray(userConfig.solidity)) {
    throw new Error("Only object Solidity compiler configuration is supported with @cloudwalk/hardhat2-config.");
  }

  const { version, settings } = userConfig.solidity as SolcUserConfig;

  if (version && version !== defaultSolidityConfig.version) {
    warnDefault("version", defaultSolidityConfig.version);
  }
  if (settings?.evmVersion && settings.evmVersion !== defaultSolidityConfig.settings?.evmVersion) {
    warnDefault("EVM target", defaultSolidityConfig.settings?.evmVersion ?? "");
  }

  return true;
}

const defaultSolidityConfig: SolcUserConfig = {
  version: "0.8.30",
  settings: {
    evmVersion: "cancun",
    optimizer: {
      enabled: true,
      runs: Number(process.env.OPTIMIZER_RUNS ?? 1000),
    },
  },
};

extendConfig((config, userConfig) => {
  if (!validateUserConfig(userConfig)) {
    process.exit(1);
  }

  for (const compiler of config.solidity.compilers) {
    compiler.settings.optimizer =
      merge({}, defaultSolidityConfig.settings.optimizer, userConfig.solidity.settings?.optimizer || {});
  }

  config.etherscan = getEtherscan();
  config.gasReporter.enabled = process.env.GAS_REPORTER_ENABLED === "true";
  config.contractSizer.runOnCompile = process.env.CONTRACT_SIZER_ENABLED === "true";
  config.mocha.rootHooks = mochaHooks();

  merge(config.networks, getDefaultNetworks(process.env));
});
