import { ethers, network, upgrades } from "hardhat";
import { DEPLOYED_CONTRACTS, ContractConfig, getContractLabel } from "./deployedContracts";
import { ValidateUpgradeOptions } from "@openzeppelin/hardhat-upgrades/src/utils";

const VALIDATION_OPTIONS: ValidateUpgradeOptions = {
  unsafeAllowRenames: false,
  unsafeSkipStorageCheck: false,
  unsafeAllow: ["delegatecall"],
};

interface ValidationResult {
  contract: ContractConfig;
  success: boolean;
  error?: string;
}

async function validateContract(contract: ContractConfig): Promise<ValidationResult> {
  const label = getContractLabel(contract);
  console.log(`Validating ${label} at ${contract.address}...`);
  try {
    const factory = await ethers.getContractFactory(contract.name);
    await upgrades.validateUpgrade(contract.address, factory, VALIDATION_OPTIONS);
    console.log(`${label} validation successful`);
    return { contract, success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`${label} validation failed: ${errorMessage}`);
    return { contract, success: false, error: errorMessage };
  }
}

async function main(): Promise<void> {
  const contracts = DEPLOYED_CONTRACTS[network.name];
  if (!contracts) {
    throw new Error(`No contracts configured for network: "${network.name}"`);
  }

  console.log(`Validating ${contracts.length} contracts on "${network.name}"...\n`);

  const results: ValidationResult[] = [];
  for (const contract of contracts) {
    results.push(await validateContract(contract));
  }

  const failed = results.filter(r => !r.success);
  const passed = results.filter(r => r.success);

  console.log("\n========== VALIDATION SUMMARY ==========");
  console.log(`Passed: ${passed.length}/${results.length}`);
  console.log(`Failed: ${failed.length}/${results.length}`);

  if (failed.length > 0) {
    console.log("\nFailed contracts:");
    for (const result of failed) {
      console.log(`  - ${getContractLabel(result.contract)}: ${result.error}`);
    }
    process.exit(1);
  }

  console.log("\nAll contracts validated successfully");
}

main().catch((err) => {
  throw err;
});
