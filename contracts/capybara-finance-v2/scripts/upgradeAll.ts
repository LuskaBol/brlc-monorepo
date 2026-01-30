import { ethers, network, upgrades } from "hardhat";
import { DEPLOYED_CONTRACTS, ContractConfig, getContractLabel } from "./deployedContracts";
import { UpgradeProxyOptions } from "@openzeppelin/hardhat-upgrades/src/utils";

const UPGRADE_OPTIONS: UpgradeProxyOptions = {
  unsafeAllowRenames: false,
  unsafeSkipStorageCheck: false,
  unsafeAllow: ["delegatecall"],
};

async function upgradeContract(contract: ContractConfig): Promise<void> {
  const label = getContractLabel(contract);
  console.log(`Upgrading ${label} at ${contract.address}...`);
  const factory = await ethers.getContractFactory(contract.name);
  await upgrades.upgradeProxy(contract.address, factory, UPGRADE_OPTIONS);
  const newImplementation = await upgrades.erc1967.getImplementationAddress(contract.address);
  console.log(`${label} at ${contract.address} upgraded. New implementation: ${newImplementation}`);
}

async function main(): Promise<void> {
  const contracts = DEPLOYED_CONTRACTS[network.name];
  if (!contracts) {
    throw new Error(`No contracts configured for network: "${network.name}"`);
  }

  console.log(`Upgrading ${contracts.length} contracts on "${network.name}"...\n`);

  for (const contract of contracts) {
    await upgradeContract(contract);
  }

  console.log("\nAll contracts upgraded successfully");
}

main().catch((err) => {
  throw err;
});
