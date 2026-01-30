import hre, { network } from "hardhat";
import { DEPLOYED_CONTRACTS, ContractConfig, getContractLabel } from "./deployedContracts";

interface VerificationResult {
  contract: ContractConfig;
  success: boolean;
  error?: string;
}

async function verifyContract(contract: ContractConfig): Promise<VerificationResult> {
  const label = getContractLabel(contract);
  console.log(`Verifying ${label} at ${contract.address}...`);
  try {
    await hre.run("verify:verify", {
      address: contract.address,
      constructorArguments: [],
    });
    console.log(`${label} verification successful`);
    return { contract, success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const alreadyVerified = errorMessage.includes("Already Verified") || errorMessage.includes("already verified");
    if (alreadyVerified) {
      console.log(`${label} already verified`);
      return { contract, success: true };
    }
    console.error(`${label} verification failed: ${errorMessage}`);
    return { contract, success: false, error: errorMessage };
  }
}

async function main(): Promise<void> {
  const contracts = DEPLOYED_CONTRACTS[network.name];
  if (!contracts) {
    throw new Error(`No contracts configured for network: "${network.name}"`);
  }

  console.log(`Verifying ${contracts.length} contracts on "${network.name}"...\n`);

  const results: VerificationResult[] = [];
  for (const contract of contracts) {
    results.push(await verifyContract(contract));
  }

  const failed = results.filter(r => !r.success);
  const passed = results.filter(r => r.success);

  console.log("\n========== VERIFICATION SUMMARY ==========");
  console.log(`Passed: ${passed.length}/${results.length}`);
  console.log(`Failed: ${failed.length}/${results.length}`);

  if (failed.length > 0) {
    console.log("\nFailed contracts:");
    for (const result of failed) {
      console.log(`  - ${getContractLabel(result.contract)}: ${result.error}`);
    }
    process.exit(1);
  }

  console.log("\nAll contracts verified successfully");
}

main().catch((err) => {
  throw err;
});
